import { Events, EmbedBuilder } from "discord.js";
import { stickyMessages } from "../data/store.js";

export const name = Events.MessageCreate;

export async function execute(message) {
  if (message.author.bot) return;

  const guildId = message.guildId;
  const channelId = message.channelId;
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
      .setColor(sticky.color || 0x5865f2)
      .setTitle(sticky.title || "📌 Pinned Message")
      .setDescription(sticky.content)
      .setTimestamp()
      .setFooter({ text: "Sticky Message" });

    const sent = await message.channel.send({ embeds: [embed] });
    sticky.lastMessageId = sent.id;
    stickyMessages.set(key, sticky);
  }
}
