import { Events, EmbedBuilder } from "discord.js";
import { welcomeChannels } from "../data/store.js";
import { NILOU_TEAL, DIVIDER } from "../theme.js";

export const name = Events.GuildMemberAdd;

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

export async function execute(member) {
  const config = welcomeChannels.get(member.guild.id);
  if (!config) return;

  const channel = member.guild.channels.cache.get(config.channelId);
  if (!channel) return;

  const joinedAt       = Math.floor(member.joinedTimestamp / 1000);
  const accountCreated = Math.floor(member.user.createdTimestamp / 1000);
  const memberCount    = member.guild.memberCount;

  const description = config.message
    ? config.message
        .replace("{user}", `<@${member.id}>`)
        .replace("{server}", member.guild.name)
        .replace("{count}", memberCount.toString())
    : `*The stage lights shimmer as a new dancer arrives...*\n\n${DIVIDER}\n\nWelcome to **${member.guild.name}**, <@${member.id}>!\nYou are the **${memberCount}${ordinal(memberCount)}** member to join our theater. 🌸\n\n${DIVIDER}`;

  const embed = new EmbedBuilder()
    .setColor(config.color || NILOU_TEAL)
    .setTitle(`🌸 ✦ ${config.title || `Welcome to ${member.guild.name}!`}`)
    .setDescription(description)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: "🌺 Account Created", value: `<t:${accountCreated}:R>`, inline: true },
      { name: "💧 Joined Server",   value: `<t:${joinedAt}:F>`,       inline: true },
      { name: "✨ Member Count",    value: `**#${memberCount}**`,       inline: true }
    )
    .setFooter({
      text: `🌸 Nilou • ID: ${member.id}`,
      iconURL: member.guild.iconURL({ dynamic: true }) || undefined,
    })
    .setTimestamp();

  await channel.send({ embeds: [embed] });
}
