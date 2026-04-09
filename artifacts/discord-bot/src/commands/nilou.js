import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { NILOU_RED, FOOTER_MAIN, DIVIDER } from "../theme.js";

const NILOU_IMAGES = [
  "https://static.wikia.nocookie.net/gensin-impact/images/d/d0/Character_Nilou_Full_Wish.png",
  "https://static.wikia.nocookie.net/gensin-impact/images/6/68/Character_Nilou_Portrait.png",
  "https://static.wikia.nocookie.net/gensin-impact/images/5/5f/Character_Nilou_Card.png",
  "https://static.wikia.nocookie.net/gensin-impact/images/4/42/Nilou_Constellation.png",
  "https://static.wikia.nocookie.net/gensin-impact/images/8/8a/Character_Nilou_Thumb.png",
  "https://upload-os-bbs.hoyolab.com/upload/2022/09/16/c3b761f2bc5c5afee94bd2ea2e7c6899_7977508248823726047.png",
  "https://upload-os-bbs.hoyolab.com/upload/2022/10/23/74d6b72b14c3543a3f7e1d1cc26e5fa0_3218791041745979543.png",
  "https://upload-os-bbs.hoyolab.com/upload/2023/01/13/4f6f5b2b3a2b3a2b3a2b3a2b3a2b3a2b_0000000000000000000.png",
  "https://act-webstatic.hoyoverse.com/game_record/genshin/character_thumbnail/UI_AvatarIcon_Nilou.png",
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

export async function execute(interaction) {
  const image   = NILOU_IMAGES[Math.floor(Math.random() * NILOU_IMAGES.length)];
  const caption = CAPTIONS[Math.floor(Math.random() * CAPTIONS.length)];

  const embed = new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle("✦ Nilou — Dancer of the Zubayr Theater")
    .setDescription(`${DIVIDER}\n${caption}\n${DIVIDER}`)
    .setImage(image)
    .setFooter(FOOTER_MAIN)
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
