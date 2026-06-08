import { Events, EmbedBuilder } from "discord.js";
import { reactionRoles, starboardConfig, starboardEntries } from "../data/store.js";
import { upsertStarboardEntry, updateStarboardEntry } from "../db/index.js";
import { getEmojiString } from "../utils/emojiCache.js";

export const name = Events.MessageReactionAdd;
export const options = { once: false };

function emojiKey(reaction) {
  return reaction.emoji.id ? `<${reaction.emoji.animated ? "a" : ""}:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;
}

function emojiMatches(reaction, targetEmoji) {
  if (!targetEmoji) return reaction.emoji.name === "⭐";
  const e = emojiKey(reaction);
  return e === targetEmoji || reaction.emoji.name === targetEmoji || reaction.emoji.id === targetEmoji;
}

export async function execute(reaction, user) {
  if (user.bot) return;
  if (reaction.partial) {
    try { await reaction.fetch(); } catch { return; }
  }

  const message = reaction.message;
  if (!message.guild) return;

  // ─── Reaction Roles ──────────────────────────────────────────────────────────
  const guildId = message.guildId;
  const messageId = message.id;
  const emoji = reaction.emoji.id ? reaction.emoji.id : reaction.emoji.name;
  const key = `${guildId}:${messageId}:${emoji}`;
  const roleId = reactionRoles.get(key);
  if (roleId) {
    const guild = message.guild;
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (member) {
      try { await member.roles.add(roleId); } catch {}
    }
  }

  // ─── Starboard ────────────────────────────────────────────────────────────────────
  const cfg = starboardConfig.get(guildId);
  if (!cfg || !cfg.enabled || !cfg.channelId) return;
  if (cfg.blacklist?.includes(message.channelId)) return;

  if (!emojiMatches(reaction, cfg.emoji)) return;

  const count = reaction.count || 1;
  if (count < (cfg.threshold || 3)) return;
  if (!cfg.selfStar && message.author.id === user.id) return;

  const starboardChannel = await message.guild.channels.fetch(cfg.channelId).catch(() => null);
  if (!starboardChannel) return;

  const starEmoji = getEmojiString("NilouHeart") || "⭐";
  const entryKey = `${guildId}:${msgId}`;
  const existing = starboardEntries.get(entryKey);

  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
    .setDescription(message.content ? message.content.slice(0, 2048) : "")
    .addFields(
      { name: "Source", value: `[Jump to message](https://discord.com/channels/${guildId}/${message.channelId}/${messageId})`, inline: true },
      { name: "Channel", value: `<#${message.channelId}>`, inline: true },
    )
    .setFooter({ text: `${message.author.id} • ${messageId}` })
    .setTimestamp(message.createdAt);

  if (message.attachments.size > 0) {
    const first = message.attachments.first();
    if (first.contentType?.startsWith("image/")) embed.setImage(first.url);
    else if (first.contentType?.startsWith("video/")) embed.setDescription((embed.data.description || "") + `\n\n[Video](${first.url})`);
  }
  if (message.embeds?.length > 0 && message.embeds[0].image?.url) {
    embed.setImage(message.embeds[0].image.url);
  }

  const content = `${starEmoji} **${count}** <#${message.channelId}>`;

  if (existing) {
    const starboardMsg = await starboardChannel.messages.fetch(existing.starboardMsgId).catch(() => null);
    if (starboardMsg) {
      await starboardMsg.edit({ content, embeds: [embed] });
      await updateStarboardEntry(guildId, messageId, count);
      starboardEntries.set(entryKey, { ...existing, starCount: count });
    }
  } else {
    const starboardMsg = await starboardChannel.send({ content, embeds: [embed] }).catch(() => null);
    if (starboardMsg) {
      starboardEntries.set(entryKey, { guildId, channelId: message.channelId, messageId, starboardMsgId: starboardMsg.id, starCount: count });
      await upsertStarboardEntry(guildId, message.channelId, messageId, starboardMsg.id, count);
    }
  }
}
