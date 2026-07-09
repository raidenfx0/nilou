import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { pool } from "../db/index.js";
import { NILOU_RED, FOOTER_GENSHIN, DIVIDER } from "../theme.js";
import * as lastfm from "../utils/lastfm.js";
import * as spotify from "../utils/spotify.js";

export const data = new SlashCommandBuilder()
  .setName("connect")
  .setDescription("Link your Last.fm or Spotify for scrobbling & now-playing cards");

export async function execute(interaction) {
  const userId = interaction.user.id;
  const rows = await pool.query("SELECT * FROM music_connections WHERE user_id=$1", [userId]);
  const conn = rows.rows[0] || null;

  const embed = new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle("🎵 Music Account Connections")
    .setDescription(
      `${DIVIDER}\n` +
      `Link your accounts for automatic **scrobbling** and **rich now-playing** embeds.\n\n` +
      `${lastfm.isConfigured() ? "✅" : "❌"} **Last.fm** — scrobbles every track you play\n` +
      `${spotify.isConfigured() ? "✅" : "❌"} **Spotify** — enables album art & metadata lookup\n\n` +
      `${DIVIDER}`
    )
    .setFooter(FOOTER_GENSHIN);

  if (conn?.lastfm_username) {
    embed.addFields({ name: "Last.fm", value: `🔗 Linked as **${conn.lastfm_username}**`, inline: true });
  }
  if (conn?.spotify_access_token) {
    embed.addFields({ name: "Spotify", value: "🔗 Linked", inline: true });
  }

  const row = new ActionRowBuilder();
  if (lastfm.isConfigured()) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId("connect_lastfm")
        .setLabel(conn?.lastfm_username ? "Re-link Last.fm" : "Link Last.fm")
        .setStyle(ButtonStyle.Primary)
    );
  }
  if (spotify.isConfigured()) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId("connect_spotify")
        .setLabel(conn?.spotify_access_token ? "Re-link Spotify" : "Link Spotify")
        .setStyle(ButtonStyle.Success)
    );
  }

  await interaction.reply({ embeds: [embed], components: row.components.length ? [row] : [], ephemeral: true });
}
