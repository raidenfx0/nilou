import { Events } from "discord.js";
import { sendLog } from "../utils/logger.js";

export const name = Events.GuildMemberRemove;

export async function execute(member) {
  const { guild, user } = member;

  await sendLog(guild, "memberLeave", {
    title: "📤 Member Left",
    description:
      `**User:** ${user.tag} (<@${user.id}>)\n` +
      `**Account Created:** <t:${Math.floor(user.createdTimestamp / 1000)}:R>\n` +
      `**Members Now:** ${guild.memberCount}`,
  });
}