import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { NILOU_RED, FOOTER_MAIN, DIVIDER } from "../theme.js";

export const data = new SlashCommandBuilder()
  .setName("serverinfo")
  .setDescription("View information about this server");

export async function execute(interaction) {
  const guild = interaction.guild;
  await guild.fetch();

  const owner        = await guild.fetchOwner();
  const createdAt    = Math.floor(guild.createdTimestamp / 1000);
  const totalMembers = guild.memberCount;
  const channels     = guild.channels.cache;
  const roles        = guild.roles.cache;

  const textChannels  = channels.filter((c) => c.type === 0).size;
  const voiceChannels = channels.filter((c) => c.type === 2).size;
  const categories    = channels.filter((c) => c.type === 4).size;
  const totalRoles    = roles.size - 1;

  const verificationLevels = {
    0: "None",
    1: "Low",
    2: "Medium",
    3: "High",
    4: "Very High",
  };

  const boostTier   = guild.premiumTier;
  const boostCount  = guild.premiumSubscriptionCount || 0;

  const embed = new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle(`🌺 ✦ ${guild.name}`)
    .setDescription(`${DIVIDER}\n${guild.description || "No description set."}\n${DIVIDER}`)
    .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }) || null)
    .addFields(
      { name: "👑 Owner",         value: `<@${owner.id}>`, inline: true },
      { name: "🆔 Server ID",     value: `\`${guild.id}\``, inline: true },
      { name: "📅 Created",       value: `<t:${createdAt}:R>`, inline: true },
      { name: "👥 Members",       value: `**${totalMembers}**`, inline: true },
      { name: "🌸 Roles",         value: `**${totalRoles}**`, inline: true },
      { name: "💬 Text Channels", value: `**${textChannels}**`, inline: true },
      { name: "🎙️ Voice Channels",value: `**${voiceChannels}**`, inline: true },
      { name: "📁 Categories",    value: `**${categories}**`, inline: true },
      { name: "🛡️ Verification",  value: `**${verificationLevels[guild.verificationLevel] || "Unknown"}**`, inline: true },
      { name: "✨ Boost Tier",    value: `**Tier ${boostTier}** (${boostCount} boosts)`, inline: true },
    )
    .setImage(guild.bannerURL({ size: 1024 }) || null)
    .setFooter(FOOTER_MAIN)
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
