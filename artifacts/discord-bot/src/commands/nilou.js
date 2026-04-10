import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { NILOU_RED, FOOTER_MAIN, DIVIDER } from "../theme.js";

/**
 * Nilou Image Database
 * Only using links verified and provided by the user.
 */
const NILOU_LINKS = [
  "https://i.pinimg.com/736x/5a/14/1f/5a141f04de343cacd31050521fb61e24.jpg",
  "https://i.pinimg.com/1200x/d7/ab/1f/d7ab1f31912239283962bf19f13a794c.jpg",
  "https://i.pinimg.com/736x/a6/20/a3/a620a3ae8c6f8e22f3258053a812674.jpg",
  "https://i.pinimg.com/1200x/6b/7b/cd/6b7bcd55563fa857c9db212ee75fe017.jpg",
  "https://i.pinimg.com/1200x/67/7c/12/677c12ab88baf61605c8ce92c42ac3bd.jpg",
  "https://i.pinimg.com/1200x/42/8b/87/428b87055e17039c405abf95f12ca616.jpg"
];

const CAPTIONS = [
  "A dance for the waters of Sumeru 🌊",
  "May the Sabzeruz Festival be eternal 🌸",
  "Her steps echo the rhythm of the rain 💧",
  "Nilou of the Zubayr Theater dances for you 🌺",
  "The flowers bloom in her footsteps 🌷",
  "Grace defined by the rhythm of the stage ✨"
];

export const data = new SlashCommandBuilder()
  .setName("nilou")
  .setDescription("Get a random Nilou image from the Zubayr Theater");

export async function execute(interaction) {
  const image = NILOU_LINKS[Math.floor(Math.random() * NILOU_LINKS.length)];
  const caption = CAPTIONS[Math.floor(Math.random() * CAPTIONS.length)];

  const embed = new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle("✦ Nilou — Dancer of the Zubayr Theater")
    .setDescription(`${DIVIDER}\n${caption}\n${DIVIDER}`)
    .setImage(image)
    .setFooter(FOOTER_MAIN)
    .setTimestamp();

  try {
    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error("Error displaying Nilou image:", error);
    await interaction.reply({ content: "The stage is being prepared, please try again!", ephemeral: true });
  }
}