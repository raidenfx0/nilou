import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { NILOU_RED, FOOTER_GENSHIN, DIVIDER } from "../theme.js";

export const data = new SlashCommandBuilder()
  .setName("about")
  .setDescription("About this bot's Genshin Impact features and data sources.");

export async function execute(interaction) {
  const embed = new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle("✦ About Nilou Bot · Genshin Features")
    .setThumbnail("https://enka.network/ui/UI_AvatarIcon_Nilou.png")
    .setDescription(
      `${DIVIDER}\n` +
      `🌸 **Nilou Bot** fetches Genshin Impact player data and character builds using the Enka.Network API, ` +
      `with crit value calculations inspired by the Akasha System.\n` +
      `${DIVIDER}`
    )
    .addFields(
      {
        name: "📊 Data Source",
        value: "Player profiles, character builds, artifact stats, and in-game showcase data are provided by **[Enka.Network](https://enka.network)**.",
        inline: false,
      },
      {
        name: "🏆 CV Calculations",
        value: "Crit Value (CV) is calculated as **(Crit Rate × 2) + Crit DMG**, inspired by **[Akasha.cv](https://akasha.cv)** algorithms.",
        inline: false,
      },
      {
        name: "⚠️ Attribution",
        value: "All game assets, character designs, and in-game data belong to **HoYoverse**. This bot is not affiliated with or endorsed by HoYoverse.",
        inline: false,
      },
      {
        name: "🌸 Genshin Commands",
        value:
          "`/register` — Link your UID\n" +
          "`/profile` — View your player profile\n" +
          "`/list` — List showcase characters or artifacts\n" +
          "`/build` — Generate a character build card\n" +
          "`/cv_calc` — Calculate artifact CV\n" +
          "`/top_artifacts` — Your best artifacts by CV\n" +
          "`/about` — This message",
        inline: false,
      }
    )
    .setFooter(FOOTER_GENSHIN)
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
