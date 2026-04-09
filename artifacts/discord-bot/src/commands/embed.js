import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("embed")
  .setDescription("Send a custom embed message")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addStringOption((o) =>
    o.setName("title").setDescription("Embed title").setRequired(true)
  )
  .addStringOption((o) =>
    o
      .setName("description")
      .setDescription("Embed description")
      .setRequired(true)
  )
  .addStringOption((o) =>
    o
      .setName("color")
      .setDescription("Hex color code (e.g. #5865F2)")
      .setRequired(false)
  )
  .addStringOption((o) =>
    o.setName("footer").setDescription("Footer text").setRequired(false)
  )
  .addStringOption((o) =>
    o
      .setName("image")
      .setDescription("Image URL to attach")
      .setRequired(false)
  )
  .addChannelOption((o) =>
    o
      .setName("channel")
      .setDescription("Channel to send the embed in (default: current)")
      .setRequired(false)
  );

export async function execute(interaction) {
  const title = interaction.options.getString("title");
  const description = interaction.options.getString("description");
  const colorInput = interaction.options.getString("color");
  const footer = interaction.options.getString("footer");
  const imageUrl = interaction.options.getString("image");
  const targetChannel =
    interaction.options.getChannel("channel") || interaction.channel;

  let color = 0x5865f2;
  if (colorInput) {
    const hex = colorInput.replace("#", "");
    const parsed = parseInt(hex, 16);
    if (!isNaN(parsed)) color = parsed;
  }

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();

  if (footer) embed.setFooter({ text: footer });
  if (imageUrl) embed.setImage(imageUrl);

  try {
    await targetChannel.send({ embeds: [embed] });
    await interaction.reply({
      content: `✅ Embed sent to <#${targetChannel.id}>!`,
      ephemeral: true,
    });
  } catch (err) {
    await interaction.reply({
      content: `❌ Failed to send embed: ${err.message}`,
      ephemeral: true,
    });
  }
}
