import { Events, EmbedBuilder, AttachmentBuilder } from "discord.js";
import { stickyMessages, afkUsers, triggers, countingChannels, pendingDrops } from "../data/store.js";
import { NILOU_RED, FOOTER_STICKY, DIVIDER } from "../theme.js";
import { getEconomy, updateEconomy, upsertCountingConfig, updateStickyLastMessage } from "../db/index.js";
import { createLevelCard } from "../utils/levelCard.js";

const chatCooldowns   = new Map(); // `${guildId}:${userId}` → timestamp
const channelMsgCount = new Map(); // `${guildId}:${channelId}` → count

const XP_PER_MSG    = 5;
const COINS_PER_MSG = 2;
const XP_COOLDOWN   = 60_000;
const DROP_EVERY    = 100;          // messages between drops
const DROP_EXPIRE   = 120_000;     // 2 min to collect

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

export const name = Events.MessageCreate;

export async function execute(message) {
  if (message.author.bot) return;
  if (!message.guild)     return;

  const { guildId, channelId } = message;
  const userId = message.author.id;

  // ─── AFK clear ──────────────────────────────────────────────────────────────
  const afkKey = `${guildId}:${userId}`;
  if (afkUsers.has(afkKey)) {
    afkUsers.delete(afkKey);
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
        const msg = await message.channel.send(`❌ **${message.author.tag}**, you can't count twice in a row! Count **resets to 0**. Next: **1**`);
        countCfg.failedAt = countCfg.currentCount; countCfg.currentCount = 0; countCfg.lastUserId = null;
        countingChannels.set(guildId, countCfg);
        await upsertCountingConfig(guildId, { channel_id: countCfg.channelId, current_count: 0, last_user_id: null, failed_at: countCfg.failedAt });
        setTimeout(() => msg.delete().catch(() => {}), 10000);
        return;
      }
      if (input !== expected) {
        await message.react("❌");
        const msg = await message.channel.send(
          `❌ **${message.author.tag}** said **${input}** but expected **${expected}**! Count **resets to 0**.\nUse \`/counting save use\` or \`/counting guild-save\` to restore! 💾`
        );
        countCfg.failedAt = countCfg.currentCount; countCfg.currentCount = 0; countCfg.lastUserId = null;
        countingChannels.set(guildId, countCfg);
        await upsertCountingConfig(guildId, { channel_id: countCfg.channelId, current_count: 0, last_user_id: null, failed_at: countCfg.failedAt });
        setTimeout(() => msg.delete().catch(() => {}), 12000);
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
      const eco      = await getEconomy(userId, guildId);
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

      await updateEconomy(userId, guildId, { exp: newExp, coins: newCoins, level: newLevel, rank: getRank(newLevel), theater_credits: newTC });
    } catch {}
  }

  // ─── Channel message counter → Theater drops ─────────────────────────────────
  const chanKey = `${guildId}:${channelId}`;
  const count   = (channelMsgCount.get(chanKey) || 0) + 1;
  channelMsgCount.set(chanKey, count);

  if (count % DROP_EVERY === 0 && !pendingDrops.has(channelId)) {
    const template = DROP_MESSAGES[Math.floor(Math.random() * DROP_MESSAGES.length)];
    const amount   = rand(template.min, template.max);
    const expiry   = Date.now() + DROP_EXPIRE;

    try {
      const embed = new EmbedBuilder()
        .setColor(NILOU_RED)
        .setDescription(`✨ **Theater Drop!**\n\n${template.text}\n\n*Expires in 2 minutes.*`)
        .setFooter({ text: "Use /collect to claim · First come first served" });

      const dropMsg = await message.channel.send({ embeds: [embed] });

      pendingDrops.set(channelId, {
        guildId, amount, type: template.type,
        itemName: null, itemId: null,
        msgId: dropMsg.id, expiry,
      });

      // Auto-expire: delete embed and remove from map
      setTimeout(async () => {
        if (pendingDrops.get(channelId)?.msgId === dropMsg.id) {
          pendingDrops.delete(channelId);
          try { await dropMsg.delete(); } catch {}
        }
      }, DROP_EXPIRE);

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
