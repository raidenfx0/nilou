import { Events, EmbedBuilder } from "discord.js";
import { stickyMessages, afkUsers, triggers, countingChannels } from "../data/store.js";
import { NILOU_RED, FOOTER_STICKY, DIVIDER } from "../theme.js";
import { getEconomy, updateEconomy, upsertCountingConfig, updateStickyLastMessage } from "../db/index.js";

const chatCooldowns   = new Map(); // `${guildId}:${userId}` → last xp timestamp
const channelMsgCount = new Map(); // `${guildId}:${channelId}` → msg count

const XP_PER_MSG    = 5;
const COINS_PER_MSG = 2;
const XP_COOLDOWN   = 60_000;
const DROP_EVERY    = 20;
const DROP_MIN_TC   = 5;
const DROP_MAX_TC   = 15;

const LEVELS = [0, 100, 250, 500, 900, 1400, 2100, 3000, 4200, 5800, 8000];
function getLevelFromExp(exp) {
  let level = 1;
  for (let i = 1; i < LEVELS.length; i++) {
    if (exp >= LEVELS[i]) level = i + 1; else break;
  }
  return level;
}

export const name = Events.MessageCreate;

export async function execute(message) {
  if (message.author.bot) return;
  if (!message.guild) return;

  const { guildId, channelId } = message;
  const userId  = message.author.id;

  // ─── AFK clear ──────────────────────────────────────────────────────────────
  const authorAfkKey = `${guildId}:${userId}`;
  if (afkUsers.has(authorAfkKey)) {
    afkUsers.delete(authorAfkKey);
    const welcome = await message.channel.send(`🌸 Welcome back, ${message.author}! Your AFK has been cleared.`);
    setTimeout(() => welcome.delete().catch(() => {}), 6000);
  }

  if (message.mentions.users.size > 0) {
    for (const [mentionedId] of message.mentions.users) {
      const afkData = afkUsers.get(`${guildId}:${mentionedId}`);
      if (afkData) {
        const sinceMin = Math.floor((Date.now() - afkData.since) / 60000);
        const sinceStr = sinceMin < 1 ? "just now" : sinceMin === 1 ? "1 min ago" : `${sinceMin} mins ago`;
        const notice   = await message.channel.send(`💤 <@${mentionedId}> is AFK — ${afkData.reason} (${sinceStr})`);
        setTimeout(() => notice.delete().catch(() => {}), 7000);
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
        const msg = await message.channel.send(
          `❌ **${message.author.tag}**, you can't count twice in a row! The count **resets to 0**. Next: **1**`
        );
        countCfg.failedAt     = countCfg.currentCount;
        countCfg.currentCount = 0;
        countCfg.lastUserId   = null;
        countingChannels.set(guildId, countCfg);
        await upsertCountingConfig(guildId, {
          channel_id: countCfg.channelId, current_count: 0,
          last_user_id: null, failed_at: countCfg.failedAt,
        });
        setTimeout(() => msg.delete().catch(() => {}), 10000);
        return;
      }

      if (input !== expected) {
        await message.react("❌");
        const msg = await message.channel.send(
          `❌ **${message.author.tag}** said **${input}** but expected **${expected}**! The count **resets to 0**. Next: **1**\n` +
          `Use \`/counting save use\` or \`/counting guild-save\` to restore! 💾`
        );
        countCfg.failedAt     = countCfg.currentCount;
        countCfg.currentCount = 0;
        countCfg.lastUserId   = null;
        countingChannels.set(guildId, countCfg);
        await upsertCountingConfig(guildId, {
          channel_id: countCfg.channelId, current_count: 0,
          last_user_id: null, failed_at: countCfg.failedAt,
        });
        setTimeout(() => msg.delete().catch(() => {}), 12000);
        return;
      }

      // Correct count
      await message.react("✅");
      countCfg.currentCount = input;
      countCfg.lastUserId   = userId;
      if (input > countCfg.highScore) countCfg.highScore = input;
      countCfg.failedAt = 0;
      countingChannels.set(guildId, countCfg);
      await upsertCountingConfig(guildId, {
        channel_id:    countCfg.channelId,
        current_count: countCfg.currentCount,
        high_score:    countCfg.highScore,
        last_user_id:  countCfg.lastUserId,
        failed_at:     0,
      });

      // Milestone messages
      if (input % 100 === 0) {
        await message.channel.send(`🌸 **${input}!** What a milestone! Keep going~`);
      }
    }
    return;
  }

  // ─── Chat XP / TC gain (60s cooldown) ──────────────────────────────────────
  const xpKey  = `${guildId}:${userId}`;
  const lastXp = chatCooldowns.get(xpKey) || 0;
  if (Date.now() - lastXp >= XP_COOLDOWN) {
    chatCooldowns.set(xpKey, Date.now());
    try {
      const eco        = await getEconomy(userId, guildId);
      const newExp     = Number(eco.exp) + XP_PER_MSG;
      const newCoins   = Number(eco.coins) + COINS_PER_MSG;
      const oldLevel   = getLevelFromExp(Number(eco.exp));
      const newLevel   = getLevelFromExp(newExp);
      let   newTC      = Number(eco.theater_credits);

      if (newLevel > oldLevel) {
        const tcReward = newLevel * 5;
        newTC         += tcReward;
        const lvlMsg = await message.channel.send(
          `🎭 ${message.author} leveled up to **Level ${newLevel}**! +${tcReward} 🎟️ Theater Credits`
        );
        setTimeout(() => lvlMsg.delete().catch(() => {}), 8000);
      }

      await updateEconomy(userId, guildId, {
        exp: newExp, coins: newCoins,
        level: newLevel, theater_credits: newTC,
      });
    } catch {}
  }

  // ─── TC drops (every DROP_EVERY messages per channel) ──────────────────────
  const chanKey = `${guildId}:${channelId}`;
  channelMsgCount.set(chanKey, (channelMsgCount.get(chanKey) || 0) + 1);
  if (channelMsgCount.get(chanKey) % DROP_EVERY === 0) {
    try {
      const dropAmt = Math.floor(Math.random() * (DROP_MAX_TC - DROP_MIN_TC + 1)) + DROP_MIN_TC;
      const eco     = await getEconomy(userId, guildId);
      await updateEconomy(userId, guildId, { theater_credits: Number(eco.theater_credits) + dropAmt });
      const dropMsg = await message.channel.send(
        `✨ ${message.author} found a **Theater Credit drop**! +${dropAmt} 🎟️`
      );
      setTimeout(() => dropMsg.delete().catch(() => {}), 10000);
    } catch {}
  }

  // ─── Sticky messages ────────────────────────────────────────────────────────
  const stickyKey = `${guildId}:${channelId}`;
  if (stickyMessages.has(stickyKey)) {
    const sticky = stickyMessages.get(stickyKey);

    if (sticky.lastMessageId) {
      try {
        const old = await message.channel.messages.fetch(sticky.lastMessageId);
        if (old) await old.delete();
      } catch {}
    }

    const embed = new EmbedBuilder()
      .setColor(sticky.color || NILOU_RED)
      .setTitle(`📌 ✦ ${sticky.title || "Pinned"}`)
      .setDescription(`${DIVIDER}\n${sticky.content}\n${DIVIDER}`)
      .setFooter(FOOTER_STICKY)
      .setTimestamp();

    const sent = await message.channel.send({ embeds: [embed] });
    sticky.lastMessageId = sent.id;
    stickyMessages.set(stickyKey, sticky);
    await updateStickyLastMessage(guildId, channelId, sent.id).catch(() => {});
  }
}
