import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getMusicConnection } from "../db/index.js";
import { NILOU_RED, FOOTER_GENSHIN, DIVIDER } from "../theme.js";
import * as lastfm from "../utils/lastfm.js";

export const data = new SlashCommandBuilder()
  .setName("fm")
  .setDescription("View your Last.fm profile or recent tracks");

export async function execute(interaction) {
  const conn = await getMusicConnection(interaction.user.id);
  if (!conn?.lastfm_username) {
    return interaction.reply({
      content: "❌ No Last.fm account linked. Use **/connect** to link your account.",
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  try {
    const info = await lastfm.getUserInfo(conn.lastfm_username);
    if (!info) {
      return interaction.editReply("❌ Could not fetch Last.fm profile.");
    }

    const embed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle(`🎵 ${info.name}'s Last.fm Profile`)
      .setURL(info.url)
      .setDescription(
        `${DIVIDER}\n` +
        `**Scrobbles:** ${info.playcount?.toLocaleString() || "0"}\n` +
        `**Artists:** ${info.artist_count?.toLocaleString() || "0"}\n` +
        `**Tracks:** ${info.track_count?.toLocaleString() || "0"}\n` +
        `**Country:** ${info.country || "Unknown"}\n` +
        `${DIVIDER}`
      )
      .setFooter(FOOTER_GENSHIN);

    if (info.image?.[2]?.["#text"]) {
      embed.setThumbnail(info.image[2]["#text"]);
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (e) {
    console.error("Last.fm profile error:", e);
    await interaction.editReply("❌ Error fetching Last.fm profile.");
  }
}
