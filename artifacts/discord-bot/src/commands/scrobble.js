import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getMusicConnection } from "../db/index.js";
import { NILOU_RED, FOOTER_GENSHIN, DIVIDER } from "../theme.js";
import * as lastfm from "../utils/lastfm.js";

const state = new Map(); // guildId -> { enabled: boolean, channelId: string | null }

export const data = new SlashCommandBuilder()
  .setName("scrobble")
  .setDescription("Toggle Last.fm scrobbling for this server")
  .addStringOption(o =>
    o.setName("mode")
      .setDescription("Enable or disable scrobbling")
      .setRequired(true)
      .addChoices(
        { name: "On", value: "on" },
        { name: "Off", value: "off" }
      )
  )
  .addChannelOption(o =>
    o.setName("channel")
      .setDescription("Optional: post scrobble summaries to this channel")
      .setRequired(false)
  );

export async function execute(interaction) {
  const mode = interaction.options.getString("mode");
  const channel = interaction.options.getChannel("channel");
  const guildId = interaction.guildId;

  if (mode === "on") {
    const conn = await getMusicConnection(interaction.user.id);
    if (!conn?.lastfm_session_key) {
      const embed = new EmbedBuilder()
        .setColor(NILOU_RED)
        .setTitle("🎵 Last.fm Not Connected")
        .setDescription(
          `${DIVIDER}\n` +
          `You need to link your Last.fm account first.\n\n` +
          `Use **/connect** then click **Link Last.fm** to authorize.\n` +
          `${DIVIDER}`
        )
        .setFooter(FOOTER_GENSHIN);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    state.set(guildId, { enabled: true, channelId: channel?.id || null });
    const embed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle("✅ Scrobbling Enabled")
      .setDescription(
        `${DIVIDER}\n` +
        `Last.fm scrobbling is now **ON** for this server.\n\n` +
        `Every track you request will be sent to your Last.fm profile.\n` +
        (channel ? `Scrobble summaries will be posted in ${channel}.\n` : "") +
        `${DIVIDER}`
      )
      .setFooter(FOOTER_GENSHIN);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  state.delete(guildId);
  const embed = new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle("❌ Scrobbling Disabled")
    .setDescription(
      `${DIVIDER}\n` +
      `Last.fm scrobbling is now **OFF** for this server.\n` +
      `${DIVIDER}`
    )
    .setFooter(FOOTER_GENSHIN);
  return interaction.reply({ embeds: [embed], ephemeral: true });
}

export function getScrobbleState(guildId) {
  return state.get(guildId) || { enabled: false };
}
