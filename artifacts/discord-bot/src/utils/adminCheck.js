import { PermissionFlagsBits } from "discord.js";
import { adminRoles } from "../data/store.js";

/**
 * Returns true if the member is allowed to use admin bot commands.
 * Passes if:
 *  - They have the Administrator Discord permission, OR
 *  - They have the configured bot admin role for this guild
 */
export function isAdmin(member) {
  if (!member) return false;

  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;

  const roleId = adminRoles.get(member.guild.id);
  if (roleId && member.roles.cache.has(roleId)) return true;

  return false;
}

export async function denyAdmin(interaction) {
  const roleId = adminRoles.get(interaction.guildId);
  const roleHint = roleId
    ? `You need the <@&${roleId}> role or Administrator permission.`
    : "You need the Administrator permission or a configured bot admin role. Ask a server admin to run \`/adminrole set\`.";

  await interaction.reply({
    content: `🌸 Only Nilou's chosen admins can use this command!\n${roleHint}`,
    ephemeral: true,
  });
}
