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

// channelId → { guildId, amount, type, itemName, msgId, expiry }
export const pendingDrops      = new Map();

export const botStats = {
  startTime: Date.now(),
};
