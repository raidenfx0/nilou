import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import { NILOU_RED, FOOTER_PURGE } from "../theme.js";

export const data = new SlashCommandBuilder()
  .setName("purge")
  .setDescription("Bulk delete messages from a channel")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addIntegerOption((o) =>
    o.setName("amount").setDescription("Number of messages to delete (1–100)").setMinValue(1).setMaxValue(100).setRequired(true)
  )
  .addUserOption((o) =>
    o.setName("user").setDescription("Only delete messages from this user").setRequired(false)
  )
  .addStringOption((o) =>
    o.setName("contains").setDescription("Only delete messages containing this text").setRequired(false)
  );

export async function execute(interaction) {
  const amount       = interaction.options.getInteger("amount");
  const targetUser   = interaction.options.getUser("user");
  const containsText = interaction.options.getString("contains");

  await interaction.deferReply({ ephemeral: true });

  try {
    let messages = await interaction.channel.messages.fetch({
      limit: targetUser || containsText ? 100 : amount,
    });

    if (targetUser)   messages = messages.filter((m) => m.author.id === targetUser.id);
    if (containsText) messages = messages.filter((m) => m.content.toLowerCase().includes(containsText.toLowerCase()));

    const toDelete  = messages.first(amount);
    const now       = Date.now();
    const twoWeeks  = 14 * 24 * 60 * 60 * 1000;
    const deletable = toDelete.filter((m) => now - m.createdTimestamp < twoWeeks);

    if (deletable.length === 0) {
      return interaction.editReply(
        "💧 Nothing to sweep away — messages older than 14 days cannot be bulk deleted."
      );
    }

    const deleted = await interaction.channel.bulkDelete(deletable, true);

    const embed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle("🌊 ✦ Stage Cleared")
      .setDescription(`Nilou swept **${deleted.size}** message${deleted.size !== 1 ? "s" : ""} from the stage.`)
      .addFields(
        { name: "🗑️ Deleted", value: `${deleted.size} messages`, inline: true },
        { name: "📍 Channel", value: `<#${interaction.channelId}>`, inline: true },
        { name: "🌸 By",      value: `<@${interaction.user.id}>`, inline: true }
      )
      .setFooter(FOOTER_PURGE)
      .setTimestamp();

    if (targetUser)   embed.addFields({ name: "👤 From User",  value: `<@${targetUser.id}>`, inline: true });
    if (containsText) embed.addFields({ name: "🔍 Containing", value: `\`${containsText}\``, inline: true });

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    await interaction.editReply(`💧 The current was too strong: ${err.message}`);
  }
}
