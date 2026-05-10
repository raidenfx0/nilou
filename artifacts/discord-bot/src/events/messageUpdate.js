import { Events } from "discord.js";
import { sendLog } from "../utils/logger.js";

export const name = Events.MessageUpdate;

export async function execute(oldMessage, newMessage) {
  if (!newMessage.guild) return;
  if (newMessage.author?.bot) return;
  if (oldMessage.content === newMessage.content) return;

  await sendLog(newMessage.guild, "messageUpdate", {
    title: "✏️ Message Edited",
    description:
      `**Author:** ${newMessage.author?.tag} (<@${newMessage.author?.id}>)\n` +
      `**Channel:** <#${newMessage.channelId}>\n` +
      `**Before:** ${oldMessage.content?.slice(0, 400) || "*No text*"}\n` +
      `**After:** ${newMessage.content?.slice(0, 400) || "*No text*"}`,
  });
}
