const CUSTOM_GUILD_ID = "1284165907362484225";

export const emojiCache = new Map();

export function getEmoji(name) {
  return emojiCache.get(name);
}

export function getEmojiString(name) {
  const e = emojiCache.get(name);
  if (!e) return "";
  return e.animated ? `<a:${e.name}:${e.id}>` : `<:${e.name}:${e.id}>`;
}

export async function initEmojiCache(client) {
  try {
    const guild = await client.guilds.fetch(CUSTOM_GUILD_ID);
    const emojis = await guild.emojis.fetch();
    for (const [id, emoji] of emojis) {
      emojiCache.set(emoji.name, { id: emoji.id, name: emoji.name, animated: emoji.animated });
      console.log(`🌸 Cached emoji: ${emoji.name} ${emoji.animated ? "(animated)" : ""}`);
    }
    console.log(`✅ Cached ${emojiCache.size} custom emojis from guild ${guild.name}`);
  } catch (err) {
    console.error(`⚠️ Could not load custom emojis from guild ${CUSTOM_GUILD_ID}:`, err.message);
  }
}
