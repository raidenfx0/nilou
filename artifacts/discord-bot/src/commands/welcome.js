import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { welcomeChannels } from "../data/store.js";

export const data = new SlashCommandBuilder()
  .setName("welcome")
  .setDescription("Configure welcome messages for new members")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub
      .setName("set")
      .setDescription("Set up welcome messages")
      .addChannelOption((o) =>
        o
          .setName("channel")
          .setDescription("Channel to send welcome messages in")
          .setRequired(true)
      )
      .addStringOption((o) =>
        o
          .setName("message")
          .setDescription(
            "Welcome message. Use {user}, {server}, {count} as placeholders"
          )
          .setRequired(false)
      )
      .addStringOption((o) =>
        o
          .setName("title")
          .setDescription("Embed title")
          .setRequired(false)
      )
      .addStringOption((o) =>
        o
          .setName("color")
          .setDescription("Hex color code (e.g. #57F287)")
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("disable").setDescription("Disable welcome messages")
  )
  .addSubcommand((sub) =>
    sub.setName("test").setDescription("Preview the welcome message for yourself")
  );

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guildId;

  if (sub === "set") {
    const channel = interaction.options.getChannel("channel");
    const message = interaction.options.getString("message");
    const title = interaction.options.getString("title");
    const colorInput = interaction.options.getString("color");

    let color = 0x57f287;
    if (colorInput) {
      const parsed = parseInt(colorInput.replace("#", ""), 16);
      if (!isNaN(parsed)) color = parsed;
    }

    welcomeChannels.set(guildId, {
      channelId: channel.id,
      message: message || null,
      title: title || null,
      color,
    });

    await interaction.reply({
      content: `✅ Welcome messages enabled in <#${channel.id}>!`,
      ephemeral: true,
    });
  } else if (sub === "disable") {
    if (!welcomeChannels.has(guildId)) {
      return interaction.reply({
        content: "❌ Welcome messages are not configured.",
        ephemeral: true,
      });
    }
    welcomeChannels.delete(guildId);
    await interaction.reply({
      content: "✅ Welcome messages disabled.",
      ephemeral: true,
    });
  } else if (sub === "test") {
    const config = welcomeChannels.get(guildId);
    if (!config) {
      return interaction.reply({
        content: "❌ Welcome messages are not configured. Use `/welcome set` first.",
        ephemeral: true,
      });
    }

    const member = interaction.member;
    const joinedAt = Math.floor(Date.now() / 1000);
    const accountCreated = Math.floor(member.user.createdTimestamp / 1000);
    const memberCount = interaction.guild.memberCount;

    const embed = new EmbedBuilder()
      .setColor(config.color || 0x57f287)
      .setTitle(config.title || `Welcome to ${interaction.guild.name}!`)
      .setDescription(
        config.message
          ? config.message
              .replace("{user}", `<@${member.id}>`)
              .replace("{server}", interaction.guild.name)
              .replace("{count}", memberCount.toString())
          : `Welcome to **${interaction.guild.name}**, <@${member.id}>! You are member **#${memberCount}**.`
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: "Account Created", value: `<t:${accountCreated}:R>`, inline: true },
        { name: "Joined Server", value: `<t:${joinedAt}:F>`, inline: true },
        { name: "Member Count", value: `**${memberCount}**`, inline: true }
      )
      .setFooter({
        text: `ID: ${member.id}`,
        iconURL: interaction.guild.iconURL({ dynamic: true }) || undefined,
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
