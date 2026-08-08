import { SlashCommandBuilder } from "discord.js";
import { createNowPlayingEmbed } from "./music.js";

export const data = new SlashCommandBuilder()
  .setName("nowplaying")
  .setDescription("Show what's currently playing with rich metadata");

export async function execute(interaction) {
  const client = interaction.client;
  const player = client.manager.players.get(interaction.guildId);

  if (!player || !player.queue?.current) {
    return interaction.reply({ content: "❌ Nothing is playing right now.", ephemeral: true });
  }

  const embed = createNowPlayingEmbed(player);
  await interaction.reply({ embeds: [embed] });
}
