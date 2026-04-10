import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { rateCV } from "../utils/genshinData.js";
import { NILOU_RED, FOOTER_GENSHIN, DIVIDER } from "../theme.js";

export const data = new SlashCommandBuilder()
  .setName("cv_calc")
  .setDescription("Calculate the Crit Value (CV) of an artifact.")
  .addNumberOption(o =>
    o.setName("crit_rate")
      .setDescription("Crit Rate % on the artifact (e.g. 6.2)")
      .setRequired(true)
      .setMinValue(0)
      .setMaxValue(100)
  )
  .addNumberOption(o =>
    o.setName("crit_dmg")
      .setDescription("Crit DMG % on the artifact (e.g. 12.4)")
      .setRequired(true)
      .setMinValue(0)
      .setMaxValue(300)
  );

export async function execute(interaction) {
  const cr = interaction.options.getNumber("crit_rate");
  const cd = interaction.options.getNumber("crit_dmg");
  const cv = parseFloat(((cr * 2) + cd).toFixed(1));
  const rating = rateCV(cv);

  const embed = new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle("✦ Artifact CV Calculator")
    .setDescription(
      `${DIVIDER}\n` +
      `**CRIT Rate:** ${cr.toFixed(1)}%\n` +
      `**CRIT DMG:** ${cd.toFixed(1)}%\n\n` +
      `**Formula:** (${cr.toFixed(1)} × 2) + ${cd.toFixed(1)} = **${cv} CV**\n\n` +
      `**Rating:** ${rating}\n` +
      `${DIVIDER}`
    )
    .addFields({
      name: "📊 CV Rating Scale",
      value:
        "🌱 Fledgling — below 100 CV\n" +
        "✅ Good — 100–139 CV\n" +
        "⭐ Great — 140–179 CV\n" +
        "💎 Legendary — 180–219 CV\n" +
        "🔱 Godly — 220+ CV",
      inline: false,
    })
    .setFooter(FOOTER_GENSHIN)
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
