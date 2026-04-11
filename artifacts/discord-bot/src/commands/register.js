import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { registerUid, getUid } from "../db/uidStore.js";
import { fetchProfile } from "../utils/enka.js"; 
import { NILOU_RED, FOOTER_GENSHIN, DIVIDER } from "../theme.js";

// Valid UID prefixes for Genshin Impact regions
const VALID_STARTS = new Set(["1","2","5","6","7","8","9"]);

/**
 * Slash Command: /register
 * Logic: Fetches Enka.network profile and checks signature for a 4-digit verification code.
 */
export const data = new SlashCommandBuilder()
  .setName("register")
  .setDescription("Link and verify your Genshin Impact UID.")
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

    const signature = data.playerInfo.signature || "";
    // Verification code is based on the last 4 digits of the user's Discord ID
    const verificationCode = `Akasha-${interaction.user.id.slice(-4)}`; 

    // 3. Check if signature matches the verification requirement
    if (signature.includes(verificationCode)) {
      // Save to database
      registerUid(interaction.user.id, str);

      const successEmbed = new EmbedBuilder()
        .setColor(NILOU_RED)
        .setTitle("✦ UID Verified & Linked")
        .setDescription(
          `${DIVIDER}\n` +
          `🌸 **UID \`${str}\`** is now officially linked to your account!\n\n` +
          `You can now use **/profile** and **/top_artifacts**.\n` +
          `${DIVIDER}`
        )
        .setFooter(FOOTER_GENSHIN);

      return interaction.editReply({ embeds: [successEmbed] });
    } else {
      // 4. Instructions for verification
      const verifyEmbed = new EmbedBuilder()
        .setColor("#FFA500")
        .setTitle("🔒 Ownership Verification Required")
        .setDescription(
          `To prevent linking accounts you don't own, please follow these steps:\n\n` +
          `1. Open Genshin Impact.\n` +
          `2. Change your **In-game Signature** to: \`${verificationCode}\`\n` +
          `3. Wait 1-2 minutes for Enka to update (Profile refresh).\n` +
          `4. Run this command again.\n\n` +
          `*Current Signature detected:* \`${signature || "Empty"}\``
        )
        .setFooter({ text: "You can change your signature back after verifying!" });

      return interaction.editReply({ embeds: [verifyEmbed] });
    }
  } catch (err) {
    console.error(err);
    return interaction.editReply(`❌ Error connecting to Enka: ${err.message}`);
  }
}