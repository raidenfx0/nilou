import { Events, EmbedBuilder } from "discord.js";
import { reactionRoles, starboardConfig, starboardEntries } from "../data/store.js";
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
      try { await member.roles.remove(roleId); } catch {}
    }
  }

  // ─── Starboard ────────────────────────────────────────────────────────────────────
  const cfg = starboardConfig.get(guildId);
  if (!cfg || !cfg.enabled || !cfg.channelId) return;
  if (!emojiMatches(reaction, cfg.emoji)) return;

  const count = reaction.count || 0;
  const entryKey = `${guildId}:${messageId}`;
  const existing = starboardEntries.get(entryKey);
  if (!existing) return;

  const starboardChannel = await message.guild.channels.fetch(cfg.channelId).catch(() => null);
  if (!starboardChannel) return;

  const starEmoji = getEmojiString("NilouHeart") || "⭐";
  const starboardMsg = await starboardChannel.messages.fetch(existing.starboardMsgId).catch(() => null);
  if (!starboardMsg) return;

  if (count < (cfg.threshold || 3)) {
    // Remove from starboard if below threshold
    await starboardMsg.delete().catch(() => {});
    starboardEntries.delete(entryKey);
    await updateStarboardEntry(guildId, messageId, 0, true);
    return;
  }

  // Update star count
  const embed = starboardMsg.embeds?.[0];
  const newContent = `${starEmoji} **${count}** <#${message.channelId}>`;
  await starboardMsg.edit({ content: newContent, embeds: embed ? [EmbedBuilder.from(embed)] : [] }).catch(() => {});
  await updateStarboardEntry(guildId, messageId, count);
  starboardEntries.set(entryKey, { ...existing, starCount: count });
}
