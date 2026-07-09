import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { NILOU_RED, FOOTER_GENSHIN, DIVIDER } from "../theme.js";

export const data = new SlashCommandBuilder()
  .setName("nowplaying")
  .setDescription("Show what's currently playing with rich metadata");

export async function execute(interaction) {
  const client = interaction.client;
  const player = client.manager.players.get(interaction.guildId);

  if (!player || !player.queue?.current) {
    return interaction.reply({ content: "❌ Nothing is playing right now.", ephemeral: true });
  }

  const track = player.queue.current;
  const source = track?.sourceName || track?.source || "unknown";
  const duration = track?.duration || track?.length || 0;
  const position = player?.position || 0;

  const minDur = Math.floor(duration / 60000);
  const secDur = Math.floor((duration % 60000) / 1000);
  const minPos = Math.floor(position / 60000);
  const secPos = Math.floor((position % 60000) / 1000);

  const barLen = 20;
  const pct = duration > 0 ? position / duration : 0;
  const filled = Math.floor(pct * barLen);
  const bar = "▬".repeat(filled) + "🔘" + "▬".repeat(Math.max(0, barLen - filled - 1));

  const embed = new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle("🌸 Now Performing")
    .setDescription(
      `${DIVIDER}\n` +
      `**${track.title}**\n` +
      `by **${track.author || "Unknown"}**\n\n` +
      `\`[${minPos}:${String(secPos).padStart(2, "0")}]\` ${bar} \`[${minDur}:${String(secDur).padStart(2, "0")}]\`\n` +
      `${DIVIDER}`
    )
    .setFooter(FOOTER_GENSHIN);

  if (track.thumbnail || track.uri) {
    const thumb = track.thumbnail || track.uri.replace("watch?v=", "vi/") + "/hqdefault.jpg";
    embed.setThumbnail(thumb);
  }

  embed.addFields(
    { name: "Source", value: source === "youtube" ? "YouTube" : source === "spotify" ? "Spotify" : source, inline: true },
    { name: "Volume", value: `${player.volume || 100}%`, inline: true }
  );

  await interaction.reply({ embeds: [embed] });
}
