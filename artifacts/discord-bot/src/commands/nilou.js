import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { NILOU_RED, FOOTER_MAIN, DIVIDER } from "../theme.js";

/**
 * Nilou Image Database
 * Using direct i.pinimg.com links to ensure they never expire.
 */
const NILOU_IMAGES = [
  "https://i.pinimg.com/736x/5a/14/1f/5a141f04de343cacd31050521fb61e24.jpg",
  "https://i.pinimg.com/736x/d7/ab/1f/d7ab1f31912239283962bf19f13a794c.jpg",
  "https://i.pinimg.com/1200x/81/a2/59/81a25914b4344629b7bf3c2761c86204.jpg",
  "https://i.pinimg.com/736x/6b/7b/cd/6b7bcd55563fa857c9db212ee75fe017.jpg",
  "https://i.pinimg.com/736x/67/7c/12/677c12ab88baf61605c8ce92c42ac3bd.jpg",
  "https://i.pinimg.com/736x/42/8b/87/428b87055e17039c405abf95f12ca616.jpg",
  "https://i.pinimg.com/736x/9d/ca/6e/9dca6ea73e6250f153ef1563ae6d8a54.jpg",
  "https://i.pinimg.com/736x/56/dd/c5/56ddc5c053d43bb714fd541579c83ffd.jpg",
  "https://i.pinimg.com/736x/3a/54/2c/3a542c3f793c6f64b99eee276842b13b.jpg",
  "https://i.pinimg.com/1200x/d9/de/db/d9dedb815ae7aee4cf30ec99f83881bd.jpg",
  "https://i.pinimg.com/736x/3c/bf/a6/3cbfa6214897da4bdb8b7c11671fb9a8.jpg",
  "https://i.pinimg.com/736x/e2/5b/09/e25b0937b153b79ec28a9688945f1789.jpg",
  "https://i.pinimg.com/736x/e2/5b/09/e25b0937b153b79ec28a9688945f1789.jpg",
  "https://i.pinimg.com/736x/55/08/80/550880dd179b281e179c4df9c1441c7e.jpg",
  "https://i.pinimg.com/736x/59/a4/f0/59a4f0e304ed019384290ff03a106725.jpg",
  "https://i.pinimg.com/1200x/29/e5/27/29e527ae63fc2856029ec4da302eed13.jpg",
  "https://i.pinimg.com/736x/a3/bc/e7/a3bce7cba64188f7e453b1bab8fc8844.jpg",
  "https://i.pinimg.com/736x/8d/34/3f/8d343f95bdb5a0f6d9c0c25e128ceb71.jpg",
  "https://i.pinimg.com/736x/e5/2e/2f/e52e2fe00e6be59e82e05cd51d4d7a4e.jpg",
  "https://i.pinimg.com/736x/d0/01/27/d00127e82a02e7be92297ade8d34b145.jpg",
  "https://i.pinimg.com/736x/a4/e9/1c/a4e91c72ce2c9f5b67a2101b606a7f3b.jpg",
  "https://i.pinimg.com/736x/0d/ff/65/0dff65e98a4293d84b01d991094b8ed0.jpg",
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
 * Executes the /nilou command
 * Linked via your index.js command handler
 */
export async function execute(interaction) {
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
    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error("Error sending Nilou embed:", error);
    // If embed fails, send just the link as a backup
    await interaction.channel.send({ content: image });
  }
}
