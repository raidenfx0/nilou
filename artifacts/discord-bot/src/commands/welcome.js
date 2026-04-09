import {
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import { welcomeChannels } from "../data/store.js";
import { NILOU_RED, FOOTER_HYDRO, DIVIDER } from "../theme.js";
import { isAdmin, denyAdmin } from "../utils/adminCheck.js";

export const data = new SlashCommandBuilder()
  .setName("welcome")
  .setDescription("Configure welcome messages for new members")
  .addSubcommand((sub) =>
    sub
      .setName("set")
      .setDescription("Set up welcome messages")
      .addChannelOption((o) =>
        o.setName("channel").setDescription("Channel to send welcome messages in").setRequired(true)
      )
      .addStringOption((o) =>
        o.setName("message").setDescription("Welcome message. Use {user}, {server}, {count}").setRequired(false)
      )
      .addStringOption((o) =>
        o.setName("title").setDescription("Embed title").setRequired(false)
      )
      .addStringOption((o) =>
        o.setName("color").setDescription("Hex color code (e.g. #E84057)").setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("disable").setDescription("Disable welcome messages")
  )
  .addSubcommand((sub) =>
    sub.setName("test").setDescription("Preview the welcome message for yourself")
  );

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function buildWelcomeEmbed(member, guild, config) {
  const joinedAt       = Math.floor(Date.now() / 1000);
  const accountCreated = Math.floor(member.user.createdTimestamp / 1000);
  const memberCount    = guild.memberCount;

  const description = config?.message
    ? config.message
        .replace("{user}", `<@${member.id}>`)
        .replace("{server}", guild.name)
        .replace("{count}", memberCount.toString())
    : `The stage lights shimmer as a new dancer arrives...\n\n${DIVIDER}\n\nWelcome to **${guild.name}**, <@${member.id}>!\nYou are the **${memberCount}${ordinal(memberCount)}** member to join our theater. 🌸\n\n${DIVIDER}`;

  return new EmbedBuilder()
    .setColor(config?.color || NILOU_RED)
    .setTitle(`🌸 ✦ ${config?.title || `Welcome to ${guild.name}!`}`)
    .setDescription(description)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: "🌺 Account Created", value: `<t:${accountCreated}:R>`, inline: true },
      { name: "💧 Joined Server",   value: `<t:${joinedAt}:F>`,       inline: true },
      { name: "✨ Member Count",    value: `**#${memberCount}**`,       inline: true }
    )
    .setFooter({
      text: `🌸 Nilou • ID: ${member.id}`,
      iconURL: guild.iconURL({ dynamic: true }) || undefined,
    })
    .setTimestamp();
}

export async function execute(interaction) {
  if (!isAdmin(interaction.member)) return denyAdmin(interaction);
  const sub     = interaction.options.getSubcommand();
  const guildId = interaction.guildId;

  if (sub === "set") {
    const channel    = interaction.options.getChannel("channel");
    const message    = interaction.options.getString("message");
    const title      = interaction.options.getString("title");
    const colorInput = interaction.options.getString("color");

    let color = NILOU_RED;
    if (colorInput) {
      const parsed = parseInt(colorInput.replace("#", ""), 16);
      if (!isNaN(parsed)) color = parsed;
    }

    welcomeChannels.set(guildId, { channelId: channel.id, message: message || null, title: title || null, color });

    await interaction.reply({
      content: `🌸 Welcome messages will bloom in <#${channel.id}>!`,
      ephemeral: true,
    });
  } else if (sub === "disable") {
    if (!welcomeChannels.has(guildId)) {
      return interaction.reply({ content: "💧 Welcome messages are not configured.", ephemeral: true });
    }
    welcomeChannels.delete(guildId);
    await interaction.reply({ content: "✨ Welcome messages gracefully disabled.", ephemeral: true });
  } else if (sub === "test") {
    const config = welcomeChannels.get(guildId);
    if (!config) {
      return interaction.reply({
        content: "💧 Not configured yet — use `/welcome set` first.",
        ephemeral: true,
      });
    }
    const embed = buildWelcomeEmbed(interaction.member, interaction.guild, config);
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
