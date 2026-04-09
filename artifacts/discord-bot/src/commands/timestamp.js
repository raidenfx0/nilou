import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

const FORMATS = [
  { name: "Short Time (3:05 PM)", value: "t" },
  { name: "Long Time (3:05:00 PM)", value: "T" },
  { name: "Short Date (01/01/2023)", value: "d" },
  { name: "Long Date (January 1, 2023)", value: "D" },
  { name: "Short Date/Time (January 1, 2023 3:05 PM)", value: "f" },
  { name: "Long Date/Time (Sunday, January 1, 2023 3:05 PM)", value: "F" },
  { name: "Relative (2 hours ago)", value: "R" },
];

export const data = new SlashCommandBuilder()
  .setName("timestamp")
  .setDescription("Generate Discord dynamic timestamps")
  .addStringOption((o) =>
    o
      .setName("datetime")
      .setDescription(
        "Date/time string (e.g. '2025-12-25', '2025-12-25 18:00', 'tomorrow 5pm')"
      )
      .setRequired(false)
  )
  .addIntegerOption((o) =>
    o
      .setName("unix")
      .setDescription("Unix timestamp in seconds")
      .setRequired(false)
  );

export async function execute(interaction) {
  let unixTs;

  const unixInput = interaction.options.getInteger("unix");
  const datetimeInput = interaction.options.getString("datetime");

  if (unixInput) {
    unixTs = unixInput;
  } else if (datetimeInput) {
    const parsed = Date.parse(datetimeInput);
    if (isNaN(parsed)) {
      return interaction.reply({
        content: `❌ Could not parse "${datetimeInput}". Try a format like \`2025-12-25\`, \`2025-12-25 18:00\`, or provide a Unix timestamp.`,
        ephemeral: true,
      });
    }
    unixTs = Math.floor(parsed / 1000);
  } else {
    unixTs = Math.floor(Date.now() / 1000);
  }

  const formatLines = FORMATS.map(
    (f) =>
      `**${f.name}**\nCode: \`<t:${unixTs}:${f.value}>\`\nPreview: <t:${unixTs}:${f.value}>`
  ).join("\n\n");

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("🕐 Dynamic Timestamps")
    .setDescription(
      `Unix timestamp: \`${unixTs}\`\n\n${formatLines}`
    )
    .setFooter({ text: "Copy a code and paste it in chat" })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
