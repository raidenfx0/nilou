import { SlashCommandBuilder } from "discord.js";

/**
 * Nilou Image Database
 * Only verified direct i.pinimg.com links.
 */
const NILOU_LINKS = [
  "https://i.pinimg.com/736x/5a/14/1f/5a141f04de343cacd31050521fb61e24.jpg",
  "https://i.pinimg.com/736x/d7/ab/1f/d7ab1f31912239283962bf19f13a794c.jpg",
  "https://i.pinimg.com/736x/a6/20/a3/a620a3ae8c6f8e22f3258053a812674.jpg",
  "https://i.pinimg.com/736x/6b/7b/cd/6b7bcd55563fa857c9db212ee75fe017.jpg",
  "https://i.pinimg.com/736x/67/7c/12/677c12ab88baf61605c8ce92c42ac3bd.jpg",
  "https://i.pinimg.com/736x/42/8b/87/428b87055e17039c405abf95f12ca616.jpg"
];

export const data = new SlashCommandBuilder()
  .setName("nilou")
  .setDescription("Get a random Nilou image");

/**
 * Executes the /nilou command
 * @param {import('discord.js').ChatInputCommandInteraction} interaction 
 */
export async function execute(interaction) {
  const image = NILOU_LINKS[Math.floor(Math.random() * NILOU_LINKS.length)];

  try {
    // Reply directly with just the image link
    // Discord will automatically expand this into a full image preview
    await interaction.reply({ content: image });
  } catch (error) {
    console.error("Error displaying Nilou image:", error);
  }
}