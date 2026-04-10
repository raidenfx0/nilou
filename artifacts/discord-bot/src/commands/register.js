import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { registerUid, getUid } from "../db/uidStore.js";
import { NILOU_RED, FOOTER_GENSHIN, DIVIDER } from "../theme.js";

const VALID_STARTS = new Set(["1","2","5","6","7","8","9"]);

export const data = new SlashCommandBuilder()
  .setName("register")
  .setDescription("Link your Genshin Impact UID to your Discord account.")
  .addIntegerOption(o =>
    o.setName("uid")
      .setDescription("Your 9-digit Genshin Impact UID")
      .setRequired(true)
      .setMinValue(100000000)
      .setMaxValue(999999999)
  );

export async function execute(interaction) {
  const uid = interaction.options.getInteger("uid");
  const str = String(uid);

  if (str.length !== 9 || !VALID_STARTS.has(str[0])) {
    return interaction.reply({
      content: "❌ That doesn't look like a valid UID. UIDs are 9 digits and start with 1, 2, 5, 6, 7, 8, or 9.",
      ephemeral: true,
    });
  }

  const existing = getUid(interaction.user.id);
  registerUid(interaction.user.id, str);

  const embed = new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle("✦ UID Registered")
    .setDescription(
      `${DIVIDER}\n` +
      `🌸 Successfully linked **UID \`${str}\`** to your account!\n\n` +
      (existing ? `*(Previously linked: \`${existing}\`)*\n\n` : "") +
      `You can now use **/profile**, **/build**, **/list**, and **/top_artifacts**.\n` +
      `${DIVIDER}`
    )
    .setFooter(FOOTER_GENSHIN)
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
