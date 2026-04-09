import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { NILOU_RED, FOOTER_MAIN } from "../theme.js";

export const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Check Nilou's heartbeat and latency");

export async function execute(interaction) {
  const sent = await interaction.deferReply({ fetchReply: true });

  const botLatency = interaction.client.ws.ping;
  const apiLatency = sent.createdTimestamp - interaction.createdTimestamp;

  const latencyBar = (ms) => {
    if (ms < 100) return "🟢 Excellent";
    if (ms < 200) return "🟡 Good";
    if (ms < 400) return "🟠 Fair";
    return "🔴 Poor";
  };

  const embed = new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle("🌸 ✦ Nilou's Heartbeat")
    .setDescription("The dancer's rhythm is steady — checking the flow of the waters...")
    .addFields(
      {
        name: "💫 Websocket Latency",
        value: `**${botLatency}ms** — ${latencyBar(botLatency)}`,
        inline: true,
      },
      {
        name: "⚡ API Latency",
        value: `**${apiLatency}ms** — ${latencyBar(apiLatency)}`,
        inline: true,
      },
      {
        name: "🕐 Checked At",
        value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
        inline: false,
      }
    )
    .setFooter(FOOTER_MAIN)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
