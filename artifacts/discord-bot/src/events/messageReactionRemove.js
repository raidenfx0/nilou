import { Events } from "discord.js";
import { reactionRoles } from "../data/store.js";

export const name = Events.MessageReactionRemove;

export async function execute(reaction, user) {
  if (user.bot) return;
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch {
      return;
    }
  }

  const guildId = reaction.message.guildId;
  const messageId = reaction.message.id;
  const emoji = reaction.emoji.id
    ? reaction.emoji.id
    : reaction.emoji.name;

  const key = `${guildId}:${messageId}:${emoji}`;
  const roleId = reactionRoles.get(key);
  if (!roleId) return;

  const guild = reaction.message.guild;
  const member = await guild.members.fetch(user.id).catch(() => null);
  if (!member) return;

  try {
    await member.roles.remove(roleId);
  } catch {}
}
