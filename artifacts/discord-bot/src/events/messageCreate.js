import { Events, EmbedBuilder } from "discord.js";
import { stickyMessages, afkUsers, triggers } from "../data/store.js";
import { NILOU_RED, FOOTER_STICKY, DIVIDER } from "../theme.js";

export const name = Events.MessageCreate;

export async function execute(message) {
  if (message.author.bot) return;
  if (!message.guild) return;

  const { guildId, channelId } = message;

  const authorAfkKey = `${guildId}:${message.author.id}`;
  if (afkUsers.has(authorAfkKey)) {
    afkUsers.delete(authorAfkKey);
    const welcome = await message.channel.send(`🌸 Welcome back, ${message.author}! Your AFK has been cleared.`);
    setTimeout(() => welcome.delete().catch(() => {}), 6000);
  }

  if (message.mentions.users.size > 0) {
    for (const [userId] of message.mentions.users) {
      const afkData = afkUsers.get(`${guildId}:${userId}`);
      if (afkData) {
        const sinceMin = Math.floor((Date.now() - afkData.since) / 60000);
        const sinceStr = sinceMin < 1 ? "just now" : sinceMin === 1 ? "1 minute ago" : `${sinceMin} minutes ago`;
        const notice   = await message.channel.send(`💤 <@${userId}> is AFK — ${afkData.reason} (${sinceStr})`);
        setTimeout(() => notice.delete().catch(() => {}), 7000);
      }
    }
  }

  const guildTriggers = triggers.get(guildId) || [];
  if (guildTriggers.length > 0) {
    const content = message.content.toLowerCase();
    for (const t of guildTriggers) {
      const matched = t.exact ? content === t.phrase : content.includes(t.phrase);
      if (matched) {
        await message.channel.send(t.response).catch(() => {});
        break;
      }
    }
  }

  const key = `${guildId}:${channelId}`;
  if (stickyMessages.has(key)) {
    const sticky = stickyMessages.get(key);

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
    stickyMessages.set(key, sticky);
  }
}
