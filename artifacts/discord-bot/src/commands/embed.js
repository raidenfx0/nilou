import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { NILOU_RED, FOOTER_MAIN } from "../theme.js";

export const data = new SlashCommandBuilder()
  .setName("embed")
  .setDescription("Send a beautiful Nilou-styled embed message")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addStringOption((o) =>
    o.setName("title").setDescription("Embed title").setRequired(true)
  )
  .addStringOption((o) =>
    o.setName("description").setDescription("Embed description").setRequired(true)
  )
  .addStringOption((o) =>
    o.setName("color").setDescription("Hex color code (e.g. #E84057)").setRequired(false)
  )
  .addStringOption((o) =>
    o.setName("footer").setDescription("Footer text").setRequired(false)
  )
  .addStringOption((o) =>
    o.setName("image").setDescription("Image URL to attach").setRequired(false)
  )
  .addStringOption((o) =>
    o.setName("thumbnail").setDescription("Thumbnail image URL").setRequired(false)
  )
  .addChannelOption((o) =>
    o.setName("channel").setDescription("Channel to send the embed in (default: current)").setRequired(false)
  );

export async function execute(interaction) {
  const title         = interaction.options.getString("title");
  const description   = interaction.options.getString("description");
  const colorInput    = interaction.options.getString("color");
  const footerText    = interaction.options.getString("footer");
  const imageUrl      = interaction.options.getString("image");
  const thumbUrl      = interaction.options.getString("thumbnail");
  const targetChannel = interaction.options.getChannel("channel") || interaction.channel;

  let color = NILOU_RED;
  if (colorInput) {
    const parsed = parseInt(colorInput.replace("#", ""), 16);
    if (!isNaN(parsed)) color = parsed;
  }

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`✦ ${title}`)
    .setDescription(description)
    .setFooter(footerText ? { text: `🌸 ${footerText}` } : FOOTER_MAIN)
    .setTimestamp();

  if (imageUrl) embed.setImage(imageUrl);
  if (thumbUrl) embed.setThumbnail(thumbUrl);

  try {
    await targetChannel.send({ embeds: [embed] });
    await interaction.reply({
      content: `🌸 Your embed has bloomed in <#${targetChannel.id}>!`,
      ephemeral: true,
    });
  } catch (err) {
    await interaction.reply({
      content: `💧 The embed failed to send: ${err.message}`,
      ephemeral: true,
    });
  }
}
