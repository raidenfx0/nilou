import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { NILOU_TEAL, FOOTER_HYDRO, DIVIDER } from "../theme.js";

const FORMATS = [
  { name: "Short Time",       style: "t", example: "3:05 PM" },
  { name: "Long Time",        style: "T", example: "3:05:00 PM" },
  { name: "Short Date",       style: "d", example: "01/01/2025" },
  { name: "Long Date",        style: "D", example: "January 1, 2025" },
  { name: "Short Date/Time",  style: "f", example: "January 1, 2025 3:05 PM" },
  { name: "Long Date/Time",   style: "F", example: "Sunday, January 1, 2025 3:05 PM" },
  { name: "Relative",         style: "R", example: "2 hours ago" },
];

export const data = new SlashCommandBuilder()
  .setName("timestamp")
  .setDescription("Generate Discord dynamic timestamps")
  .addStringOption((o) =>
    o.setName("datetime").setDescription("Date/time string (e.g. '2025-12-25 18:00')").setRequired(false)
  )
  .addIntegerOption((o) =>
    o.setName("unix").setDescription("Unix timestamp in seconds").setRequired(false)
  );

export async function execute(interaction) {
  let unixTs;

  const unixInput    = interaction.options.getInteger("unix");
  const datetimeInput = interaction.options.getString("datetime");

  if (unixInput) {
    unixTs = unixInput;
  } else if (datetimeInput) {
    const parsed = Date.parse(datetimeInput);
    if (isNaN(parsed)) {
      return interaction.reply({
        content: `💧 Nilou couldn't read that time — try a format like \`2025-12-25\` or \`2025-12-25 18:00\`.`,
        ephemeral: true,
      });
    }
    unixTs = Math.floor(parsed / 1000);
  } else {
    unixTs = Math.floor(Date.now() / 1000);
  }

  const rows = FORMATS.map(
    (f) => `\`<t:${unixTs}:${f.style}>\` → <t:${unixTs}:${f.style}> *(${f.name})*`
  ).join("\n");

  const embed = new EmbedBuilder()
    .setColor(NILOU_TEAL)
    .setTitle("🕐 ✦ Dynamic Timestamps")
    .setDescription(
      `> Unix: \`${unixTs}\`\n${DIVIDER}\n${rows}\n${DIVIDER}\n*Copy any code above and paste it into chat!*`
    )
    .setFooter(FOOTER_HYDRO)
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
