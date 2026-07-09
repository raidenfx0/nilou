import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getMusicConnection } from "../db/index.js";
import { NILOU_RED, FOOTER_GENSHIN, DIVIDER } from "../theme.js";

const API_KEY = process.env.LASTFM_API_KEY || "";

export const data = new SlashCommandBuilder()
  .setName("fmrecent")
  .setDescription("Show your recently scrobbled tracks from Last.fm");

async function callApi(params) {
  const url = new URL("https://ws.audioscrobbler.com/2.0/");
  for (const [k, v] of Object.entries(params)) {
    if (v != null) url.searchParams.set(k, String(v));
  }
  url.searchParams.set("api_key", API_KEY);
  url.searchParams.set("format", "json");
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function execute(interaction) {
  if (!API_KEY) {
    return interaction.reply({
      content: "❌ Last.fm integration is not configured.",
      ephemeral: true,
    });
  }

  const conn = await getMusicConnection(interaction.user.id);
  if (!conn?.lastfm_username) {
    return interaction.reply({
      content: "❌ No Last.fm account linked. Use **/connect** to link your account.",
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  try {
    const data = await callApi({
      method: "user.getRecentTracks",
      user: conn.lastfm_username,
      limit: 5,
    });

    const tracks = data?.recenttracks?.track;
    if (!tracks || !tracks.length) {
      return interaction.editReply("🎵 No recent tracks found.");
    }

    const list = (Array.isArray(tracks) ? tracks : [tracks]).slice(0, 5)
      .map((t, i) => {
        const isNow = t["@attr"]?.nowplaying === "true";
        const name = t.name;
        const artist = t.artist?.["#text"] || t.artist;
        return `${i + 1}. ${isNow ? "🔊" : "📑"} **${name}** \u2014 ${artist}`;
      }).join("\n");

    const embed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle(`🎵 Recent Tracks — ${conn.lastfm_username}`)
      .setDescription(`${DIVIDER}\n${list}\n${DIVIDER}`)
      .setFooter(FOOTER_GENSHIN);

    await interaction.editReply({ embeds: [embed] });
  } catch (e) {
    console.error("fmrecent error:", e);
    await interaction.editReply("❌ Error fetching recent tracks.");
  }
}
