import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { welcomeChannels } from "../data/store.js";
import { upsertGuildSettings } from "../db/index.js";
import { NILOU_RED, FOOTER_HYDRO, DIVIDER } from "../theme.js";
import { isAdmin, denyAdmin } from "../utils/adminCheck.js";

export const data = new SlashCommandBuilder()
  .setName("welcome")
  .setDescription("Configure the welcome embed for new members")
  .addSubcommand(sub =>
    sub.setName("set").setDescription("Configure the welcome message")
      .addChannelOption(o => o.setName("channel").setDescription("Channel to send welcome messages in").setRequired(true))
      .addStringOption(o => o.setName("title").setDescription("Embed title (use {server} for server name)").setRequired(false))
      .addStringOption(o => o.setName("message").setDescription("Description. Use {user} {server} {count} {user.name} {user.tag}").setRequired(false))
      .addStringOption(o => o.setName("color").setDescription("Hex color (e.g. #E84057)").setRequired(false))
      .addStringOption(o => o.setName("thumbnail").setDescription("Thumbnail: 'avatar', a URL, or 'none'").setRequired(false))
      .addStringOption(o => o.setName("image").setDescription("Banner image URL at the bottom of the embed").setRequired(false))
      .addBooleanOption(o => o.setName("show_fields").setDescription("Show account age / join date / member count fields?").setRequired(false))
  )
  .addSubcommand(sub => sub.setName("disable").setDescription("Disable welcome messages"))
  .addSubcommand(sub => sub.setName("test").setDescription("Preview the welcome message"))
  .addSubcommand(sub => sub.setName("info").setDescription("View current welcome config"));

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function buildWelcomeEmbed(member, guild, config) {
  const joinedAt       = Math.floor(Date.now() / 1000);
  const accountCreated = Math.floor(member.user.createdTimestamp / 1000);
  const memberCount    = guild.memberCount;

  const rawDesc = config?.message || `Welcome to **${guild.name}**, {user}!\nYou are the **{count}${ordinal(memberCount)}** member to join our theater. 🌸`;

  const description = rawDesc
    .replace(/{user}/g, `<@${member.id}>`)
    .replace(/{server}/g, guild.name)
    .replace(/{count}/g, memberCount.toString())
    .replace(/{user\.tag}/g, member.user.tag)
    .replace(/{user\.name}/g, member.user.username);

  const embed = new EmbedBuilder()
    .setColor(config?.color || NILOU_RED)
    .setTitle(`🌸 ✦ ${(config?.title || "Welcome to {server}!").replace(/{server}/g, guild.name)}`)
    .setDescription(`${DIVIDER}\n${description}\n${DIVIDER}`)
    .setFooter({ text: `🌸 Nilou • ID: ${member.id}`, iconURL: guild.iconURL({ dynamic: true }) || undefined })
    .setTimestamp();

  const thumb = config?.thumbnail;
  if (thumb === "avatar" || !thumb) embed.setThumbnail(member.user.displayAvatarURL({ dynamic: true }));
  else if (thumb !== "none" && thumb.startsWith("http")) embed.setThumbnail(thumb);

  if (config?.image && config.image.startsWith("http")) embed.setImage(config.image);

  if (config?.showFields !== false) {
    embed.addFields(
      { name: "🌺 Account Created", value: `<t:${accountCreated}:R>`, inline: true },
      { name: "💧 Joined Server",   value: `<t:${joinedAt}:F>`,       inline: true },
      { name: "✨ Member Count",    value: `**#${memberCount}**`,       inline: true }
    );
  }
  return embed;
}

export async function execute(interaction) {
  if (!isAdmin(interaction.member)) return denyAdmin(interaction);
  const sub     = interaction.options.getSubcommand();
  const guildId = interaction.guildId;

  if (sub === "set") {
    const channel   = interaction.options.getChannel("channel");
    const title     = interaction.options.getString("title") || null;
    const message   = interaction.options.getString("message") || null;
    const colorIn   = interaction.options.getString("color");
    const thumbnail = interaction.options.getString("thumbnail") || "avatar";
    const image     = interaction.options.getString("image") || null;
    const showFields = interaction.options.getBoolean("show_fields") ?? true;

    let color = NILOU_RED;
    if (colorIn) { const p = parseInt(colorIn.replace("#", ""), 16); if (!isNaN(p)) color = p; }

    const config = { channelId: channel.id, title, message, color, thumbnail, image, showFields };
    welcomeChannels.set(guildId, config);

    await upsertGuildSettings(guildId, {
      welcome_channel_id:  channel.id,
      welcome_title:       title,
      welcome_description: message,
      welcome_color:       color,
      welcome_thumbnail:   thumbnail,
      welcome_image_url:   image,
      welcome_show_fields: showFields,
    });

    await interaction.reply({ content: `🌸 Welcome messages configured for <#${channel.id}>! Use \`/welcome test\` to preview.`, ephemeral: true });

  } else if (sub === "disable") {
    if (!welcomeChannels.has(guildId)) return interaction.reply({ content: "💧 Welcome messages are not configured.", ephemeral: true });
    welcomeChannels.delete(guildId);
    await upsertGuildSettings(guildId, { welcome_channel_id: null });
    await interaction.reply({ content: "✨ Welcome messages disabled.", ephemeral: true });

  } else if (sub === "test") {
    const config = welcomeChannels.get(guildId);
    if (!config) return interaction.reply({ content: "💧 Not configured yet — use `/welcome set` first.", ephemeral: true });
    const embed = buildWelcomeEmbed(interaction.member, interaction.guild, config);
    await interaction.reply({ embeds: [embed], ephemeral: true });

  } else if (sub === "info") {
    const config = welcomeChannels.get(guildId);
    if (!config) return interaction.reply({ content: "💧 No welcome config set. Use `/welcome set` to configure.", ephemeral: true });
    const embed = new EmbedBuilder().setColor(NILOU_RED)
      .setTitle("✦ Welcome Config")
      .addFields(
        { name: "Channel",    value: `<#${config.channelId}>`,                      inline: true },
        { name: "Color",      value: `#${config.color?.toString(16) || "E84057"}`, inline: true },
        { name: "Thumbnail",  value: config.thumbnail || "avatar",                  inline: true },
        { name: "Show Fields",value: config.showFields !== false ? "Yes" : "No",   inline: true },
        { name: "Title",      value: config.title || "*(default)*",                 inline: false },
        { name: "Message",    value: config.message ? config.message.slice(0, 200) : "*(default)*", inline: false },
      )
      .setFooter(FOOTER_HYDRO).setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
