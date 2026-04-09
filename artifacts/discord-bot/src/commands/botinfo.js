import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { NILOU_RED, FOOTER_MAIN, DIVIDER } from "../theme.js";

export const data = new SlashCommandBuilder()
  .setName("botinfo")
  .setDescription("Learn about Nilou and her story");

export async function execute(interaction) {
  const client      = interaction.client;
  const uptime      = process.uptime();
  const days        = Math.floor(uptime / 86400);
  const hours       = Math.floor((uptime % 86400) / 3600);
  const minutes     = Math.floor((uptime % 3600) / 60);
  const seconds     = Math.floor(uptime % 60);
  const uptimeStr   = `${days}d ${hours}h ${minutes}m ${seconds}s`;

  const totalGuilds = client.guilds.cache.size;
  const totalUsers  = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
  const ping        = client.ws.ping;

  const embed = new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle("🌸 ✦ About Nilou")
    .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
    .setDescription(
      `${DIVIDER}\n` +
      `Nilou is a graceful dancer from the Zubayr Theater of Sumeru, whose performances move even the gods. ` +
      `She now serves as your server's guardian — keeping order, welcoming new members, and watching over the stage.\n` +
      `${DIVIDER}`
    )
    .addFields(
      { name: "🌺 Bot Name",    value: `**${client.user.tag}**`, inline: true },
      { name: "🎨 Created By",  value: "**soda**", inline: true },
      { name: "💫 Library",     value: "**discord.js v14**", inline: true },
      { name: "🌍 Servers",     value: `**${totalGuilds}**`, inline: true },
      { name: "👥 Users",       value: `**${totalUsers}**`, inline: true },
      { name: "💧 Ping",        value: `**${ping}ms**`, inline: true },
      { name: "⏱️ Uptime",      value: `**${uptimeStr}**`, inline: true },
      { name: "✨ Theme",       value: "**Nilou — Hydro Dancer of Sumeru**", inline: true },
    )
    .setFooter({ text: "🌸 Nilou — Made with love by soda" })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
