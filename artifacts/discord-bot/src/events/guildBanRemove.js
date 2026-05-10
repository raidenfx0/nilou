import { Events } from "discord.js";
import { sendLog } from "../utils/logger.js";

export const name = Events.GuildBanRemove;

export async function execute(ban) {
  const { guild, user } = ban;

  await sendLog(guild, "banRemove", {
    title: "🔓 Member Unbanned",
    description: `**User:** ${user.tag} (<@${user.id}>)`,
  });
}
