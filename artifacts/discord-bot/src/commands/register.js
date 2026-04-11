import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { registerUid, getUid } from "../db/uidStore.js";
import { fetchProfile } from "../utils/enka.js"; // You'll need this to check signatures
import { NILOU_RED, FOOTER_GENSHIN, DIVIDER } from "../theme.js";

const VALID_STARTS = new Set(["1","2","5","6","7","8","9"]);

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
    // 2. Fetch profile from Enka to check signature
    const data = await fetchProfile(str);
    if (!data || !data.playerInfo) {
      return interaction.editReply("❌ Could not find this UID on Enka.Network. Make sure your profile is public!");
    }

    const signature = data.playerInfo.signature || "";
    const verificationCode = `Akasha-${interaction.user.id.slice(-4)}`; 

    // 3. Verification Check
    // If the signature contains the code, we register it.
    // Otherwise, we tell them what to put in their signature.
    if (signature.includes(verificationCode)) {
      const existing = getUid(interaction.user.id);
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
      // 4. Verification Instructions
      const verifyEmbed = new EmbedBuilder()
        .setColor("#FFA500")
        .setTitle("🔒 Ownership Verification Required")
        .setDescription(
          `To prevent linking accounts you don't own, please follow these steps:\n\n` +
          `1. Open Genshin Impact.\n` +
          `2. Change your **In-game Signature** to: \`${verificationCode}\`\n` +
          `3. Wait 1-2 minutes for Enka to update.\n` +
          `4. Run this command again.\n\n` +
          `*Current Signature detected:* \`${signature || "Empty"}\``
        )
        .setFooter({ text: "You can change your signature back after verifying!" });

      return interaction.editReply({ embeds: [verifyEmbed] });
    }
  } catch (err) {
    return interaction.editReply(`❌ Error connecting to Enka: ${err.message}`);
  }
}