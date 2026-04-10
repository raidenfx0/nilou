import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { NILOU_RED, FOOTER_MAIN, DIVIDER } from "../theme.js";

const NILOU_IMAGES = [
  "https://cdn.discordapp.com/attachments/1284165907362484233/1492133517252100217/Nilou_Edit.jpeg?ex=69da3921&is=69d8e7a1&hm=d416fec141bd53f45104f6f3080fcfa3846ee7548c8c7728b9f230751c6c3000&",
  "https://cdn.discordapp.com/attachments/1284165907362484233/1492133518346813482/Nilou___Genshin_Impact.jpeg?ex=69da3921&is=69d8e7a1&hm=e46445185a2c52fb30a4c99c83fc72c01f1ac3dd5795691f7778e2553c8338f7&",
  "https://cdn.discordapp.com/attachments/1284165907362484233/1492133518732562605/Nilou_2.jpeg?ex=69da3921&is=69d8e7a1&hm=5b3606ad29cd223af3ba92bfa2767744f125cfe82432d8170040c7bd1fba26f0&",
  "https://cdn.discordapp.com/attachments/1284165907362484233/1492133519084753046/Nilou_1.jpeg?ex=69da3921&is=69d8e7a1&hm=1a3586c829ef6b939949d0f79c93fd8670640dbab7ae9f33da0c0f452d91f0cd&",
  "https://cdn.discordapp.com/attachments/1284165907362484233/1492133519399452762/Nilou_Genshin_Impact.jpeg?ex=69da3921&is=69d8e7a1&hm=188df9b5f4b37cdc6245ca978112ab732b5a1ff6f724b90455787c60463ef344&",
  "https://cdn.discordapp.com/attachments/1284165907362484233/1492133519722418206/Nilou_-_Genshin.jpeg?ex=69da3921&is=69d8e7a1&hm=90efe0e0e1054b9ed966d7c27b87612f31a8bb90408842f97f8ebc9d7adf907d&",
  "https://cdn.discordapp.com/attachments/1284165907362484233/1492133621002403971/nilou.jpeg?ex=69da3939&is=69d8e7b9&hm=022c8b4ef1b2c579a036dd905c9b9f6a8aa668cd8ba4f652152805b2d32caf8e&",
  "https://cdn.discordapp.com/attachments/1284165907362484233/1492133621392347299/download_6.jpeg?ex=69da3939&is=69d8e7b9&hm=f1f5e10998fb0622336f33865ed148f97cb8feced7fd8ef5325a134cac5fa8c9&",
  "https://cdn.discordapp.com/attachments/1178069457256587364/1207453399235170314/20240214_222525.jpg?ex=69da225b&is=69d8d0db&hm=0520b73e90a14f193b2462d8f51ef2f8669d4a910f19226990474c87eaac3347",
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
