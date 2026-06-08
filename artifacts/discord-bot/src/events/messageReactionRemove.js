import { Events, EmbedBuilder } from "discord.js";
import { reactionRoles, starboards, starboardEntries } from "../data/store.js";
import { updateStarboardEntry } from "../db/index.js";
import { getEmojiString } from "../utils/emojiCache.js";

export const name = Events.MessageReactionRemove;

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
      try { await member.roles.remove(roleId); } catch {}
    }
  }

  // ─── Starboard ────────────────────────────────────────────────────────────────────────────────
  const sb = getStarboardForReaction(guildId, reaction);
  if (!sb) return;

  const count = reaction.count || 0;
  const entryKey = `${guildId}:${sb.emoji}:${messageId}`;
  const existing = starboardEntries.get(entryKey);
  if (!existing) return;

  const starboardChannel = await message.guild.channels.fetch(sb.channelId).catch(() => null);
  if (!starboardChannel) return;

  const starEmoji = getEmojiString("NilouHeart") || "⭐";
  const starboardMsg = await starboardChannel.messages.fetch(existing.starboardMsgId).catch(() => null);
  if (!starboardMsg) return;

  if (count < (sb.threshold || 3)) {
    await starboardMsg.delete().catch(() => {});
    starboardEntries.delete(entryKey);
    await updateStarboardEntry(guildId, sb.id, messageId, 0, true);
    return;
  }

  const embed = starboardMsg.embeds?.[0];
  const newContent = `${starEmoji} **${count}** ${sb.emoji} <#${message.channelId}>`;
  await starboardMsg.edit({ content: newContent, embeds: embed ? [EmbedBuilder.from(embed)] : [] }).catch(() => {});
  await updateStarboardEntry(guildId, sb.id, messageId, count);
  starboardEntries.set(entryKey, { ...existing, starCount: count });
}
