import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { registerUid } from "../db/uidStore.js";
import { fetchProfile } from "../utils/enka.js"; 
import { NILOU_RED, FOOTER_GENSHIN, DIVIDER } from "../theme.js";

// Valid UID prefixes for Genshin Impact regions
const VALID_STARTS = new Set(["1","2","5","6","7","8","9"]);

/**
 * Slash Command: /register
 * Logic: Validates UID and links it after confirming it exists on Enka.Network.
 */
export const data = new SlashCommandBuilder()
  .setName("register")
  .setDescription("Link your Genshin Impact UID.")
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

  // 1. Basic Validation
  if (!VALID_STARTS.has(str[0])) {
    return interaction.reply({
      content: "❌ Invalid UID. Must start with 1, 2, 5, 6, 7, 8, or 9.",
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    // 2. Fetch data from Enka API
    const data = await fetchProfile(str);
    if (!data || !data.playerInfo) {
      return interaction.editReply("❌ Could not find this UID on Enka.Network. Make sure your 'Show Character Details' is public in-game!");
    }

    // Save to database once the UID is confirmed reachable on Enka.
    registerUid(interaction.user.id, str);

    const successEmbed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle("✦ UID Linked")
      .setDescription(
        `${DIVIDER}\n` +
        `🌸 **UID \`${str}\`** is now linked to your account!\n\n` +
        `You can now use **/profile** and **/top_artifacts**.\n` +
        `${DIVIDER}`
      )
      .setFooter(FOOTER_GENSHIN);

    return interaction.editReply({ embeds: [successEmbed] });
  } catch (err) {
    console.error(err);
    return interaction.editReply(`❌ Error connecting to Enka: ${err.message}`);
  }
}