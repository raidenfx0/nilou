import { Events } from "discord.js";
import { sendLog } from "../utils/logger.js";

export const name = Events.GuildBanAdd;

export async function execute(ban) {
  const { guild, user, reason } = ban;

  await sendLog(guild, "banAdd", {
    title: "🔨 Member Banned",
    description:
      `**User:** ${user.tag} (<@${user.id}>)\n` +
      `**Reason:** ${reason || "No reason provided"}`,
  });
}
