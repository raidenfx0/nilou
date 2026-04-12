import { Events, EmbedBuilder } from "discord.js";
import { welcomeChannels } from "../data/store.js";
import { guildStore } from "../db/store.js";
import { NILOU_RED, DIVIDER } from "../theme.js";

export const name = Events.GuildMemberAdd;

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

export async function execute(member) {
  const { guild, user } = member;

  // --- PART 1: AUTO-ROLE LOGIC ---
  const roleType = user.bot ? 'botRole' : 'humanRole';
  const autoRoleId = guildStore.get(guild.id, roleType);

  if (autoRoleId) {
    try {
      const role = await guild.roles.fetch(autoRoleId);
      if (role && role.editable) {
        await member.roles.add(role);
        console.log(`🌸 Auto-assigned ${role.name} to ${user.tag}`);
      }
    } catch (err) {
      console.error(`❌ Auto-role Error:`, err.message);
    }
  }

  // --- PART 2: WELCOME MESSAGE LOGIC ---
  const config = welcomeChannels.get(guild.id);
  if (!config) return;

  const channel = guild.channels.cache.get(config.channelId);
  if (!channel) return;

  const joinedAt = Math.floor(member.joinedTimestamp / 1000);
  const accountCreated = Math.floor(user.createdTimestamp / 1000);
  const memberCount = guild.memberCount;

  const description = config.message
    ? config.message
        .replace("{user}", `<@${member.id}>`)
        .replace("{server}", guild.name)
        .replace("{count}", memberCount.toString())
    : `The stage lights shimmer as a new dancer arrives...\n\n${DIVIDER}\n\nWelcome to **${guild.name}**, <@${member.id}>!\nYou are the **${memberCount}${ordinal(memberCount)}** member to join our theater. 🌸\n\n${DIVIDER}`;

  const embed = new EmbedBuilder()
    .setColor(config.color || NILOU_RED)
    .setTitle(`🌸 ✦ ${config.title || `Welcome to ${guild.name}!`}`)
    .setDescription(description)
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: "🌺 Account Created", value: `<t:${accountCreated}:R>`, inline: true },
      { name: "💧 Joined Server", value: `<t:${joinedAt}:F>`, inline: true },
      { name: "✨ Member Count", value: `**#${memberCount}**`, inline: true }
    )
    .setFooter({
      text: `🌸 Nilou • ID: ${member.id}`,
      iconURL: guild.iconURL({ dynamic: true }) || undefined,
    })
    .setTimestamp();

  try {
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error(`❌ Welcome Message Error:`, err.message);
  }
}