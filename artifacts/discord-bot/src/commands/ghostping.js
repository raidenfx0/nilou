import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
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
        o.setName("logchannel").setDescription("Channel to log ghost pings (default: same channel)").setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("disable").setDescription("Disable ghost ping detection")
  )
  .addSubcommand((sub) =>
    sub.setName("status").setDescription("Check ghost ping detection status")
  );

export async function execute(interaction) {
  const sub     = interaction.options.getSubcommand();
  const guildId = interaction.guildId;

  if (sub === "enable") {
    const logChannel = interaction.options.getChannel("logchannel");
    ghostPingChannels.set(guildId, logChannel?.id || null);

    await interaction.reply({
      content: logChannel
        ? `👁️ Ghost ping detector awakened — alerts flow to <#${logChannel.id}>.`
        : "👁️ Ghost ping detector awakened — alerts appear in the same channel.",
      ephemeral: true,
    });
  } else if (sub === "disable") {
    if (!ghostPingChannels.has(guildId)) {
      return interaction.reply({ content: "💧 Ghost ping detection isn't enabled.", ephemeral: true });
    }
    ghostPingChannels.delete(guildId);
    await interaction.reply({ content: "🌊 Ghost ping detector lulled to sleep.", ephemeral: true });
  } else if (sub === "status") {
    const enabled      = ghostPingChannels.has(guildId);
    const logChannelId = ghostPingChannels.get(guildId);
    await interaction.reply({
      content: enabled
        ? `👁️ Ghost ping detection is **active**${logChannelId ? ` (logging to <#${logChannelId}>)` : " (same channel)"}.`
        : "💧 Ghost ping detection is **inactive**.",
      ephemeral: true,
    });
  }
}
