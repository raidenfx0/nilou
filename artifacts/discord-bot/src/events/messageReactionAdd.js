import { Events, EmbedBuilder } from "discord.js";
import { reactionRoles, starboards, starboardEntries } from "../data/store.js";
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

function getStarboardForReaction(guildId, reaction) {
  for (const [key, sb] of starboards) {
    if (!key.startsWith(`${guildId}:`)) continue;
    if (!sb.enabled || !sb.channelId) continue;
    if (emojiMatches(reaction, sb.emoji)) return sb;
  }
  return null;
}

export async function execute(reaction, user) {
  if (user.bot) return;
  if (reaction.partial) {
    try { await reaction.fetch(); } catch { return; }
  }

  const message = reaction.message;
  if (!message.guild) return;

  const guildId = message.guildId;
  const messageId = message.id;

  // ─── Reaction Roles ───────────────────────────────────────────────────────────
  const emoji = reaction.emoji.id ? reaction.emoji.id : reaction.emoji.name;
  const roleKey = `${guildId}:${messageId}:${emoji}`;
  const roleId = reactionRoles.get(roleKey);
  if (roleId) {
    const guild = message.guild;
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (member) {
      try { await member.roles.add(roleId); } catch {}
    }
  }

  // ─── Starboard ────────────────────────────────────────────────────────────────────────────────
  const sb = getStarboardForReaction(guildId, reaction);
  if (!sb) return;
  if (sb.blacklist?.includes(message.channelId)) return;

  const count = reaction.count || 1;
  if (count < (sb.threshold || 3)) return;
  if (!sb.selfStar && message.author.id === user.id) return;

  const starboardChannel = await message.guild.channels.fetch(sb.channelId).catch(() => null);
  if (!starboardChannel) return;

  const starEmoji = "⭐";
  const entryKey = `${guildId}:${sb.emoji}:${messageId}`;
  const existing = starboardEntries.get(entryKey);

  let description = message.content ? message.content.slice(0, 2048) : "";

  if (message.attachments.size > 0) {
    const first = message.attachments.first();
    if (first.contentType?.startsWith("image/")) {
      // image will be set as embed image
    } else if (first.contentType?.startsWith("video/")) {
      description += (description ? "\n\n" : "") + `[Video](${first.url})`;
    }
  }

  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) });

  if (description) {
    embed.setDescription(description);
  }

  embed.addFields(
    { name: "Source", value: `[Jump to message](https://discord.com/channels/${guildId}/${message.channelId}/${messageId})`, inline: true },
    { name: "Channel", value: `<#${message.channelId}>`, inline: true },
  )
    .setFooter({ text: `${message.author.id} • ${messageId}` })
    .setTimestamp(message.createdAt);

  if (message.attachments.size > 0) {
    const first = message.attachments.first();
    if (first.contentType?.startsWith("image/")) embed.setImage(first.url);
  }
  if (message.embeds?.length > 0 && message.embeds[0].image?.url) {
    embed.setImage(message.embeds[0].image.url);
  }

  const content = `${starEmoji} **${count}** ${sb.emoji} <#${message.channelId}>`;
  let videoUrl = "";
  if (message.attachments.size > 0) {
    const first = message.attachments.first();
    if (first.contentType?.startsWith("video/")) {
      videoUrl = first.url;
    }
  }
  if (message.embeds?.length > 0 && message.embeds[0].video?.url) {
    videoUrl = message.embeds[0].video.url;
  }

  if (existing) {
    const starboardMsg = await starboardChannel.messages.fetch(existing.starboardMsgId).catch(() => null);
    if (starboardMsg) {
      await starboardMsg.edit({ content: videoUrl ? `${content}\n${videoUrl}` : content, embeds: [embed] });
      await updateStarboardEntry(guildId, sb.id, messageId, count);
      starboardEntries.set(entryKey, { ...existing, starCount: count });
    }
  } else {
    const starboardMsg = await starboardChannel.send({ content: videoUrl ? `${content}\n${videoUrl}` : content, embeds: [embed] }).catch(() => null);
    if (starboardMsg) {
      starboardEntries.set(entryKey, {
        guildId,
        starboardId: sb.id,
        channelId: message.channelId,
        messageId,
        starboardMsgId: starboardMsg.id,
        starCount: count,
      });
      await upsertStarboardEntry(guildId, sb.id, message.channelId, messageId, starboardMsg.id, count);
    }
  }
}
