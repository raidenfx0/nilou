import { Events, EmbedBuilder, AttachmentBuilder } from "discord.js";
import { stickyMessages, afkUsers, triggers, countingChannels, pendingDrops, dropChannels, dropSchedules, activityCounters } from "../data/store.js";
import { NILOU_RED, FOOTER_STICKY, DIVIDER } from "../theme.js";
import { getEconomy, updateEconomy, upsertCountingConfig, updateStickyLastMessage, upsertUserActivity, upsertGuildSettings, clearAfk } from "../db/index.js";
import { createLevelCard } from "../utils/levelCard.js";
import { handleModmailMessage } from "../commands/modmail.js";

const chatCooldowns   = new Map(); // `${guildId}:${userId}` → timestamp

const XP_PER_MSG    = 5;
const COINS_PER_MSG = 2;
const XP_COOLDOWN   = 60_000;
const DROP_EXPIRE   = 120_000;     // 2 min to collect
const ACTIVITY_FLUSH_MS = 30_000;
const DROP_SLOTS_PER_WEEK = 3;
const DROP_MIN_LEAD_MS = 5 * 60_000;
const DROP_MIN_WINDOW_MS = 30 * 60_000;
const WEEK_MS = 7 * 24 * 60 * 60_000;
const dropTimers = new Map();

// Giveaway activity only needs aggregate counters. Batch writes so busy
// channels do not create one PostgreSQL query per message.
async function flushActivity() {
  const batch = [...activityCounters.values()];
  activityCounters.clear();
  await Promise.all(batch.map((entry) => upsertUserActivity(
    entry.guildId,
    entry.userId,
    entry.timestamp,
    entry.count,
    entry.count,
    entry.dayKey,
    entry.monthKey,
  ).catch(() => {})));
}

const activityFlushTimer = setInterval(() => { void flushActivity(); }, ACTIVITY_FLUSH_MS);
activityFlushTimer.unref?.();

// EXP thresholds (same as economy.js)
const LEVELS = [0, 100, 300, 600, 1100, 1800, 2700, 3800, 5200, 7000, 9200,
  12000, 15500, 19700, 24800, 31000, 38500, 47500, 58000, 70500, 85000];
function getLevelFromExp(exp) {
  let lv = 1;
  for (let i = 1; i < LEVELS.length; i++) {
    if (exp >= LEVELS[i]) lv = i + 1; else break;
  }
  return lv;
}
function getRank(lv) {
  const RANKS = [
    { name: "Stagehand",  min: 1  },
    { name: "Performer",  min: 5  },
    { name: "Soloist",    min: 10 },
    { name: "Star",       min: 20 },
    { name: "Idol",       min: 35 },
    { name: "Legend",     min: 50 },
  ];
  return [...RANKS].reverse().find(r => lv >= r.min)?.name || "Stagehand";
}

// Theater-themed drop messages
const DROP_MESSAGES = [
  { text: "The performance was so breathtaking that the audience is showering the stage with gifts! Use `/collect` to gather them!", type: "coins",  min: 100, max: 400 },
  { text: "As the curtains close, you spot a glimmering Stage Relic left behind by the lead performer. Quick, `/collect` it!",     type: "tc",     min: 10,  max: 40  },
  { text: "An admirer from the front row tossed a silk pouch toward the stage. Use `/collect` to see what's inside!",              type: "coins",  min: 200, max: 600 },
  { text: "A flurry of Padisarah Petals has settled on the stage after Nilou's dance. `/collect` them before they drift away!",    type: "tc",     min: 15,  max: 50  },
  { text: "The Grand Bazaar merchant tripped and scattered their coin purse! Use `/collect` to grab some before it's swept up!",   type: "coins",  min: 150, max: 500 },
  { text: "A mysterious gift box appeared center stage... `/collect` it before anyone else does!",                                  type: "coins",  min: 300, max: 800 },
  { text: "Nilou left behind a small pouch of Theater Credits after her performance! `/collect` before someone else does!",        type: "tc",     min: 20,  max: 60  },
  { text: "An enchanted prop from tonight's show has rolled off the stage! `/collect` the golden stage gem!",                      type: "fame",   min: 50,  max: 150 },
  { text: "Rain of rose petals and gold coins are falling from the rafters! Use `/collect` to grab your share!",                   type: "coins",  min: 250, max: 700 },
];

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function getUtcWeekStart(timestamp = Date.now()) {
  const date = new Date(timestamp);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() - daysSinceMonday,
  );
}

function getWeekKey(weekStart) {
  return new Date(weekStart).toISOString().slice(0, 10);
}

function createWeeklyDropSchedule(now = Date.now()) {
  let weekStart = getUtcWeekStart(now);
  let weekEnd = weekStart + WEEK_MS;
  let windowStart = Math.max(now + DROP_MIN_LEAD_MS, weekStart + DROP_MIN_LEAD_MS);
  let windowEnd = weekEnd - DROP_MIN_LEAD_MS;

  // If the bot comes online during the final minutes of a week, make a full
  // plan for the next week instead of bunching three drops together.
  if (windowEnd - windowStart < DROP_MIN_WINDOW_MS) {
    weekStart = weekEnd;
    weekEnd = weekStart + WEEK_MS;
    windowStart = weekStart + DROP_MIN_LEAD_MS;
    windowEnd = weekEnd - DROP_MIN_LEAD_MS;
  }

  const segment = (windowEnd - windowStart) / DROP_SLOTS_PER_WEEK;
  const slots = Array.from({ length: DROP_SLOTS_PER_WEEK }, (_, index) => {
    const segmentStart = windowStart + segment * index;
    const jitter = segment * (0.2 + Math.random() * 0.6);
    return { at: Math.floor(segmentStart + jitter), sent: false };
  });

  return { weekKey: getWeekKey(weekStart), slots };
}

async function persistDropSchedule(guildId, schedule) {
  await upsertGuildSettings(guildId, {
    theater_drop_week: schedule.weekKey,
    theater_drop_schedule: JSON.stringify({ slots: schedule.slots }),
  });
}

function clearDropTimers(guildId) {
  const timers = dropTimers.get(guildId) || [];
  for (const timer of timers) clearTimeout(timer);
  dropTimers.delete(guildId);
}

async function resolveDropChannel(guild) {
  const configured = dropChannels.get(guild.id);
  if (configured) {
    const channel = await guild.channels.fetch(configured.channelId).catch(() => null);
    if (channel?.isTextBased() && typeof channel.send === "function") return channel;
  }

  const candidates = [
    guild.systemChannel,
    ...guild.channels.cache.values(),
  ];
  return candidates.find((channel) =>
    channel?.isTextBased?.() &&
    channel.viewable !== false &&
    typeof channel.send === "function"
  ) || null;
}

async function sendScheduledTheaterDrop(guild) {
  const channel = await resolveDropChannel(guild);
  if (!channel || pendingDrops.has(channel.id)) return;

  const template = DROP_MESSAGES[Math.floor(Math.random() * DROP_MESSAGES.length)];
  const amount = rand(template.min, template.max);
  const rewardLabel = template.type === "coins"
    ? `💠 ${amount.toLocaleString()} Coins`
    : template.type === "tc"
      ? `🎟️ ${amount.toLocaleString()} Theater Credits`
      : `🎭 ${amount.toLocaleString()} Fame`;
  const expiry = Date.now() + DROP_EXPIRE;

  const embed = new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle("✨ Theater Drop")
    .setDescription(`${template.text}\n\n**Reward:** ${rewardLabel}\n\n*First to use \`/collect\` wins · Expires in 2 minutes*`)
    .setFooter({ text: "Nilou Bot • The stage is yours" })
    .setTimestamp();

  const dropMsg = await channel.send({ embeds: [embed] });
  pendingDrops.set(channel.id, {
    guildId: guild.id,
    amount,
    type: template.type,
    itemName: null,
    itemId: null,
    msgId: dropMsg.id,
    expiry,
  });

  setTimeout(async () => {
    if (pendingDrops.get(channel.id)?.msgId === dropMsg.id) {
      pendingDrops.delete(channel.id);
      try { await dropMsg.delete(); } catch {}
    }
  }, DROP_EXPIRE);
}

async function fireScheduledDrop(guild, slotIndex) {
  const schedule = dropSchedules.get(guild.id);
  const slot = schedule?.slots?.[slotIndex];
  if (!schedule || !slot || slot.sent) return;

  // Mark before sending so a quick restart cannot announce the same reward twice.
  slot.sent = true;
  await persistDropSchedule(guild.id, schedule);

  try {
    await sendScheduledTheaterDrop(guild);
  } catch (error) {
    slot.sent = false;
    await persistDropSchedule(guild.id, schedule).catch(() => {});
    console.error(`❌ Theater Drop failed in ${guild.name}:`, error.message);
  }
}

function armDropSchedule(guild, schedule) {
  clearDropTimers(guild.id);
  const timers = [];
  const now = Date.now();
  let changed = false;

  for (const [index, slot] of schedule.slots.entries()) {
    if (slot.sent) continue;
    if (slot.at <= now) {
      slot.sent = true;
      changed = true;
      continue;
    }

    timers.push(setTimeout(() => {
      void fireScheduledDrop(guild, index);
    }, Math.max(1_000, slot.at - now)));
  }

  if (changed) void persistDropSchedule(guild.id, schedule).catch(() => {});

  const weekEnd = getUtcWeekStart(now) + WEEK_MS;
  timers.push(setTimeout(() => {
    void ensureWeeklyDropSchedule(guild);
  }, Math.max(1_000, weekEnd - now + 1_000)));
  dropTimers.set(guild.id, timers);
}

async function ensureWeeklyDropSchedule(guild) {
  const currentWeek = getWeekKey(getUtcWeekStart());
  let schedule = dropSchedules.get(guild.id);

  if (!schedule || schedule.weekKey !== currentWeek) {
    schedule = createWeeklyDropSchedule();
    dropSchedules.set(guild.id, schedule);
    await persistDropSchedule(guild.id, schedule);
  }

  armDropSchedule(guild, schedule);
}

export async function startTheaterDropScheduler(client) {
  for (const guild of client.guilds.cache.values()) {
    await scheduleTheaterDropsForGuild(guild);
  }
}

export async function scheduleTheaterDropsForGuild(guild) {
  await ensureWeeklyDropSchedule(guild).catch((error) => {
    console.error(`❌ Theater Drop scheduler failed for ${guild.name}:`, error.message);
  });
}

export const name = Events.MessageCreate;

export async function execute(message) {
  if (!message) return;
  if (message.author?.bot) return;
  const handledByModmail = await handleModmailMessage(message).catch((error) => {
    console.error("ModMail message handling failed:", error.message);
    return false;
  });
  if (handledByModmail || !message.guild) return;

  const { guildId, channelId } = message;
  const userId = message.author.id;

  // ─── User activity tracking (giveaway eligibility) ─────────────────────────────
  // Store only one aggregate row per guild/user; flush at most twice a minute.
  const now = Date.now();
  const date = new Date(now);
  const activityKey = `${guildId}:${userId}`;
  const current = activityCounters.get(activityKey);
  const dayKey = date.toISOString().slice(0, 10);
  const monthKey = date.toISOString().slice(0, 7);
  if (current && current.dayKey === dayKey && current.monthKey === monthKey) {
    current.count += 1;
    current.timestamp = now;
  } else {
    if (current) void upsertUserActivity(
      current.guildId, current.userId, current.timestamp, current.count, current.count,
      current.dayKey, current.monthKey,
    ).catch(() => {});
    activityCounters.set(activityKey, { guildId, userId, timestamp: now, count: 1, dayKey, monthKey });
  }

  // ─── AFK clear ──────────────────────────────────────────────────────────────
  const afkKey = `${guildId}:${userId}`;
  if (afkUsers.has(afkKey)) {
    afkUsers.delete(afkKey);
    await clearAfk(guildId, userId).catch(() => {});
    const m = await message.channel.send(`🌸 Welcome back, ${message.author}! Your AFK has been cleared.`);
    setTimeout(() => m.delete().catch(() => {}), 6000);
  }

  if (message.mentions.users.size > 0) {
    for (const [mentionedId] of message.mentions.users) {
      const afkData = afkUsers.get(`${guildId}:${mentionedId}`);
      if (afkData) {
        const sinceMin = Math.floor((Date.now() - afkData.since) / 60000);
        const sinceStr = sinceMin < 1 ? "just now" : sinceMin === 1 ? "1 min ago" : `${sinceMin} mins ago`;
        const n = await message.channel.send(`💤 <@${mentionedId}> is AFK — ${afkData.reason} (${sinceStr})`);
        setTimeout(() => n.delete().catch(() => {}), 7000);
      }
    }
  }

  // ─── Triggers ───────────────────────────────────────────────────────────────
  const guildTriggers = triggers.get(guildId) || [];
  if (guildTriggers.length > 0) {
    const content = message.content.toLowerCase();
    for (const t of guildTriggers) {
      if (t.exact ? content === t.phrase : content.includes(t.phrase)) {
        await message.channel.send(t.response).catch(() => {});
        break;
      }
    }
  }

  // ─── Counting game ──────────────────────────────────────────────────────────
  const countCfg = countingChannels.get(guildId);
  if (countCfg && channelId === countCfg.channelId) {
    const expected = countCfg.currentCount + 1;
    const input    = parseInt(message.content.trim(), 10);

    if (!isNaN(input)) {
      if (userId === countCfg.lastUserId) {
        await message.react("❌");
        await message.channel.send(`❌ **${message.author.tag}**, you can't count twice in a row! Count **resets to 0**. Next: **1**`);
        countCfg.failedAt = countCfg.currentCount; countCfg.currentCount = 0; countCfg.lastUserId = null;
        countingChannels.set(guildId, countCfg);
        await upsertCountingConfig(guildId, { channel_id: countCfg.channelId, current_count: 0, last_user_id: null, failed_at: countCfg.failedAt });
        return;
      }
      if (input !== expected) {
        await message.react("❌");
        await message.channel.send(
          `❌ **${message.author.tag}** said **${input}** but expected **${expected}**! Count **resets to 0**.\nUse \`/counting save use\` or \`/counting guild-save\` to restore! 💾`
        );
        countCfg.failedAt = countCfg.currentCount; countCfg.currentCount = 0; countCfg.lastUserId = null;
        countingChannels.set(guildId, countCfg);
        await upsertCountingConfig(guildId, { channel_id: countCfg.channelId, current_count: 0, last_user_id: null, failed_at: countCfg.failedAt });
        return;
      }
      await message.react("✅");
      countCfg.currentCount = input; countCfg.lastUserId = userId;
      if (input > countCfg.highScore) countCfg.highScore = input;
      countCfg.failedAt = 0;
      countingChannels.set(guildId, countCfg);
      await upsertCountingConfig(guildId, { channel_id: countCfg.channelId, current_count: input, high_score: countCfg.highScore, last_user_id: userId, failed_at: 0 });
      if (input % 100 === 0) await message.channel.send(`🌸 **${input}!** What a milestone! Keep going~`);
    }
    return;
  }

  // ─── Chat XP / Coin gain (60s cooldown) ─────────────────────────────────────
  const xpKey  = `${guildId}:${userId}`;
  const lastXp = chatCooldowns.get(xpKey) || 0;
  if (Date.now() - lastXp >= XP_COOLDOWN) {
    chatCooldowns.set(xpKey, Date.now());
    try {
      const eco      = await getEconomy(userId);
      const oldExp   = Number(eco.exp);
      const newExp   = oldExp + XP_PER_MSG;
      const newCoins = Number(eco.coins) + COINS_PER_MSG;
      const oldLevel = getLevelFromExp(oldExp);
      const newLevel = getLevelFromExp(newExp);
      let   newTC    = Number(eco.theater_credits);

      if (newLevel > oldLevel) {
        const tcReward = newLevel * 5;
        newTC += tcReward;

        try {
          const buf  = await createLevelCard({
            username:    message.author.username,
            avatarUrl:   message.author.displayAvatarURL({ extension: "png", size: 256 }),
            level:       newLevel,
            rewardLines: [`🎟️ +${tcReward} Theater Credits`, `Rank: ${getRank(newLevel)}`],
          });
          const file  = new AttachmentBuilder(buf, { name: "levelup.png" });
          const lvMsg = await message.channel.send({ content: `🎭 ${message.author} leveled up to **Level ${newLevel}** — ${getRank(newLevel)}!`, files: [file] });
          setTimeout(() => lvMsg.delete().catch(() => {}), 15000);
        } catch {
          const lvMsg = await message.channel.send(`🎭 ${message.author} leveled up to **Level ${newLevel}** — ${getRank(newLevel)}! +${tcReward} 🎟️`);
          setTimeout(() => lvMsg.delete().catch(() => {}), 8000);
        }
      }

      await updateEconomy(userId, { exp: newExp, coins: newCoins, level: newLevel, rank: getRank(newLevel), theater_credits: newTC });
    } catch {}
  }

  // ─── Sticky messages ─────────────────────────────────────────────────────────
  const stickyKey = `${guildId}:${channelId}`;
  if (stickyMessages.has(stickyKey)) {
    const sticky = stickyMessages.get(stickyKey);

    if (sticky.lastMessageId) {
      try { const old = await message.channel.messages.fetch(sticky.lastMessageId); if (old) await old.delete(); } catch {}
    }

    let sent;
    if (sticky.type === "plain") {
      sent = await message.channel.send(sticky.content);
    } else {
      const embed = new EmbedBuilder()
        .setColor(sticky.color || NILOU_RED)
        .setTitle(`📌 ✦ ${sticky.title || "Pinned"}`)
        .setDescription(`${DIVIDER}\n${sticky.content}\n${DIVIDER}`)
        .setFooter(sticky.footer ? { text: `📌 ${sticky.footer}` } : FOOTER_STICKY)
        .setTimestamp();
      if (sticky.image)     embed.setImage(sticky.image);
      if (sticky.thumbnail) embed.setThumbnail(sticky.thumbnail);
      sent = await message.channel.send({ embeds: [embed] });
    }

    sticky.lastMessageId = sent.id;
    stickyMessages.set(stickyKey, sticky);
    await updateStickyLastMessage(guildId, channelId, sent.id).catch(() => {});
  }
}
