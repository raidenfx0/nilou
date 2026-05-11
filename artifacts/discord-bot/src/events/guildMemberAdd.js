import { Events, EmbedBuilder } from "discord.js";
import { welcomeChannels } from "../data/store.js";
import { NILOU_RED, DIVIDER } from "../theme.js";
import { sendLog } from "../utils/logger.js";

export const name = Events.GuildMemberAdd;

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

export async function execute(member) {
  const { guild, user } = member;

  const config = welcomeChannels.get(guild.id);
  if (!config) return;

  const channel = guild.channels.cache.get(config.channelId);
  if (!channel) return;

  const joinedAt       = Math.floor(member.joinedTimestamp / 1000);
  const accountCreated = Math.floor(user.createdTimestamp / 1000);
  const memberCount    = guild.memberCount;

  const description = config.message
    ? config.message
        .replace(/{user}/g, `<@${member.id}>`)
        .replace(/{server}/g, guild.name)
        .replace(/{count}/g, memberCount.toString())
        .replace(/{user\.tag}/g, user.tag)
        .replace(/{user\.name}/g, user.username)
    : `Welcome to **${guild.name}**, <@${member.id}>!\nYou are the **${memberCount}${ordinal(memberCount)}** member to join. 🌸`;

  const embed = new EmbedBuilder()
    .setColor(config.color || NILOU_RED)
    .setTitle(`🌸 ✦ ${config.title || `Welcome to ${guild.name}!`}`)
    .setDescription(`${DIVIDER}\n${description}\n${DIVIDER}`)
    .setFooter({ text: `🌸 Nilou • ID: ${member.id}`, iconURL: guild.iconURL({ dynamic: true }) || undefined })
    .setTimestamp();

  if (config.thumbnail === "avatar") embed.setThumbnail(user.displayAvatarURL({ dynamic: true }));
  else if (config.thumbnail && config.thumbnail.startsWith("http")) embed.setThumbnail(config.thumbnail);

  if (config.image && config.image.startsWith("http")) embed.setImage(config.image);

  if (config.showFields !== false) {
    embed.addFields(
      { name: "🌺 Account Created", value: `<t:${accountCreated}:R>`, inline: true },
      { name: "💧 Joined Server",   value: `<t:${joinedAt}:F>`,       inline: true },
      { name: "✨ Member Count",    value: `**#${memberCount}**`,       inline: true }
    );
  }

  try {
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error(`❌ Welcome Message Error:`, err.message);
  }

  await sendLog(guild, "memberJoin", {
    title: "📥 Member Joined",
    description:
      `**User:** ${user.tag} (<@${user.id}>)\n` +
      `**Account Created:** <t:${Math.floor(user.createdTimestamp / 1000)}:R>\n` +
      `**Members Now:** ${guild.memberCount}`,
  });
}
