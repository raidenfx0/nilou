import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { adminRoles } from "../data/store.js";
import { NILOU_RED, FOOTER_MAIN } from "../theme.js";

export const data = new SlashCommandBuilder()
  .setName("adminrole")
  .setDescription("Set which role can use Nilou's admin commands")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((sub) =>
    sub
      .setName("set")
      .setDescription("Set the bot admin role")
      .addRoleOption((o) =>
        o.setName("role").setDescription("Role that can use admin commands").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("remove").setDescription("Remove the admin role restriction (Admins only)")
  )
  .addSubcommand((sub) =>
    sub.setName("view").setDescription("View the current admin role")
  );

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guildId;

  if (sub === "set") {
    const role = interaction.options.getRole("role");
    adminRoles.set(guildId, role.id);

    const embed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle("🌸 ✦ Admin Role Set")
      .setDescription(`<@&${role.id}> can now use all of Nilou's admin commands.`)
      .addFields(
        { name: "🌺 Role", value: `<@&${role.id}>`, inline: true },
        { name: "✨ Set By", value: `<@${interaction.user.id}>`, inline: true }
      )
      .setFooter(FOOTER_MAIN)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } else if (sub === "remove") {
    if (!adminRoles.has(guildId)) {
      return interaction.reply({ content: "💧 No admin role is configured.", ephemeral: true });
    }
    adminRoles.delete(guildId);
    await interaction.reply({
      content: "✨ Admin role removed. Only users with Administrator permission can use admin commands now.",
      ephemeral: true,
    });
  } else if (sub === "view") {
    const roleId = adminRoles.get(guildId);
    if (!roleId) {
      return interaction.reply({
        content: "💧 No admin role set. Only users with Administrator permission can use admin commands.",
        ephemeral: true,
      });
    }
    await interaction.reply({
      content: `🌸 Current bot admin role: <@&${roleId}>`,
      ephemeral: true,
    });
  }
}
