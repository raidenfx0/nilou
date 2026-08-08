export const stickyMessages    = new Map();
export const reactionRoles     = new Map();
export const welcomeChannels   = new Map();
export const ghostPingChannels = new Map();
export const adminRoles        = new Map();
export const countdowns        = new Map();
export const afkUsers          = new Map();
export const tickets           = new Map();
export const ticketConfig      = new Map();
export const giveaways         = new Map();
export const triggers          = new Map();
export const pinnedCountdowns  = new Map();
export const loggingConfig     = new Map();
export const countingChannels  = new Map();
// `${guildId}:${userId}` → { guildId, userId, timestamp, count, dayKey, monthKey }
// Kept small and flushed periodically for giveaway activity requirements.
export const activityCounters  = new Map();

// channelId → { guildId, amount, type, itemName, msgId, expiry }
export const pendingDrops      = new Map();

// guildId → { channelId }  (drops redirect target)
export const dropChannels      = new Map();

// guildId:emoji → { id, name, channelId, emoji, threshold, selfStar, enabled, blacklist[] }
export const starboards = new Map();

// guildId:emoji:messageId → { guildId, starboardId, channelId, messageId, starboardMsgId, starCount }
export const starboardEntries = new Map();

export const botStats = {
  startTime: Date.now(),
};
