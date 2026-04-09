import { Events, EmbedBuilder } from "discord.js";
import { stickyMessages } from "../data/store.js";
import { NILOU_TEAL, FOOTER_STICKY, DIVIDER } from "../theme.js";

export const name = Events.MessageCreate;

export async function execute(message) {
  if (message.author.bot) return;

  const key = `${message.guildId}:${message.channelId}`;

  if (stickyMessages.has(key)) {
    const sticky = stickyMessages.get(key);

    if (sticky.lastMessageId) {
      try {
        const old = await message.channel.messages.fetch(sticky.lastMessageId);
        if (old) await old.delete();
      } catch {}
    }

    const embed = new EmbedBuilder()
      .setColor(sticky.color || NILOU_TEAL)
      .setTitle(`📌 ✦ ${sticky.title || "Pinned"}`)
      .setDescription(`${DIVIDER}\n${sticky.content}\n${DIVIDER}`)
      .setFooter(FOOTER_STICKY)
      .setTimestamp();

    const sent = await message.channel.send({ embeds: [embed] });
    sticky.lastMessageId = sent.id;
    stickyMessages.set(key, sticky);
  }
}
