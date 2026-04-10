import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { NILOU_RED, FOOTER_MAIN, DIVIDER } from "../theme.js";

/**
 * We use optimized image URLs. 
 * Note: Some wikia links need the part after '.png' or '.jpg' removed 
 * to be viewed directly in Discord embeds.
 */
const NILOU_IMAGES = [
  "https://static.wikia.nocookie.net/gensin-impact/images/5/58/Character_Nilou_Card.png",
  "https://static.wikia.nocookie.net/gensin-impact/images/a/a2/Nilou_Icon.png",
  "https://static.wikia.nocookie.net/gensin-impact/images/2/22/Character_Nilou_Wish.png",
  "https://static.wikia.nocookie.net/gensin-impact/images/b/b3/Character_Nilou_Full_Wish.png",
  "https://static.wikia.nocookie.net/gensin-impact/images/f/f6/Nilou_Birthday_2023.png",
  "https://static.wikia.nocookie.net/gensin-impact/images/a/a5/Nilou_Birthday_2022.png",
  "https://pbs.twimg.com/media/Fdb8m70XoAAnuS0?format=jpg&name=large"
];

const CAPTIONS = [
  "A dance for the waters of Sumeru 🌊",
  "May the Sabzeruz Festival be eternal 🌸",
  "Her steps echo the rhythm of the rain 💧",
  "Nilou of the Zubayr Theater dances for you 🌺",
  "Let the flowers bloom wherever she treads 🌷",
  "The most graceful dancer under the sun ✨",
  "Her heart dances for all of Sumeru 🎊",
  "Even the gods pause to watch her perform 🌙",
];

export const data = new SlashCommandBuilder()
  .setName("nilou")
  .setDescription("Get a random Nilou image from the Zubayr Theater");

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction 
 */
export async function execute(interaction) {
  // Select random elements
  const image = NILOU_IMAGES[Math.floor(Math.random() * NILOU_IMAGES.length)];
  const caption = CAPTIONS[Math.floor(Math.random() * CAPTIONS.length)];

  const embed = new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle("✦ Nilou — Dancer of the Zubayr Theater")
    .setDescription(`${DIVIDER}\n${caption}\n${DIVIDER}`)
    .setImage(image)
    .setFooter(FOOTER_MAIN)
    .setTimestamp();

  try {
    // Ensuring the interaction is handled safely
    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error("Error sending Nilou embed:", error);

    const errorMessage = { content: "The dance was interrupted! (Image display error)", ephemeral: true };

    if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
    } else {
        await interaction.reply(errorMessage);
    }
  }
}