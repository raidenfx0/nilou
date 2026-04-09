import {
  SlashCommandBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { ghostPingChannels } from "../data/store.js";

export const data = new SlashCommandBuilder()
  .setName("ghostping")
  .setDescription("Configure ghost ping detection")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub
      .setName("enable")
      .setDescription("Enable ghost ping detection")
      .addChannelOption((o) =>
        o
          .setName("logchannel")
          .setDescription(
            "Channel to log ghost pings (default: same channel where it happened)"
          )
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("disable").setDescription("Disable ghost ping detection")
  )
  .addSubcommand((sub) =>
    sub.setName("status").setDescription("Check ghost ping detection status")
  );

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guildId;

  if (sub === "enable") {
    const logChannel = interaction.options.getChannel("logchannel");

    ghostPingChannels.set(guildId, logChannel?.id || null);

    await interaction.reply({
      content: logChannel
        ? `✅ Ghost ping detection enabled! Alerts will be sent to <#${logChannel.id}>.`
        : "✅ Ghost ping detection enabled! Alerts will be sent in the same channel.",
      ephemeral: true,
    });
  } else if (sub === "disable") {
    if (!ghostPingChannels.has(guildId)) {
      return interaction.reply({
        content: "❌ Ghost ping detection is not enabled.",
        ephemeral: true,
      });
    }
    ghostPingChannels.delete(guildId);
    await interaction.reply({
      content: "✅ Ghost ping detection disabled.",
      ephemeral: true,
    });
  } else if (sub === "status") {
    const enabled = ghostPingChannels.has(guildId);
    const logChannelId = ghostPingChannels.get(guildId);
    await interaction.reply({
      content: enabled
        ? `✅ Ghost ping detection is **enabled**${logChannelId ? ` (logging to <#${logChannelId}>)` : " (logging in same channel)"}.`
        : "❌ Ghost ping detection is **disabled**.",
      ephemeral: true,
    });
  }
}
