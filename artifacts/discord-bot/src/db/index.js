import pg from "pg";
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
export { pool };

// ─── Guild Settings ───────────────────────────────────────────────────────────
export async function getGuildSettings(guildId) {
  const r = await pool.query("SELECT * FROM guild_settings WHERE guild_id = $1", [guildId]);
  return r.rows[0] || null;
}

export async function upsertGuildSettings(guildId, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const setClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
  const vals = [guildId, ...keys.map(k => fields[k])];
  await pool.query(
    `INSERT INTO guild_settings (guild_id, ${keys.join(", ")}) VALUES ($1, ${keys.map((_, i) => `$${i + 2}`).join(", ")})
     ON CONFLICT (guild_id) DO UPDATE SET ${setClauses}, updated_at = NOW()`,
    vals
  );
}

export async function getAllGuildSettings() {
  const r = await pool.query("SELECT * FROM guild_settings");
  return r.rows;
}

// ─── AFK ─────────────────────────────────────────────────────────────────────────────────
export async function setAfk(guildId, userId, reason, since) {
  await pool.query(
    `INSERT INTO afk_users (guild_id, user_id, reason, since) VALUES ($1,$2,$3,$4)
     ON CONFLICT (guild_id, user_id) DO UPDATE SET reason=$3, since=$4`,
    [guildId, userId, reason, since]
  );
}
export async function clearAfk(guildId, userId) {
  await pool.query("DELETE FROM afk_users WHERE guild_id=$1 AND user_id=$2", [guildId, userId]);
}
export async function getAllAfk() {
  const r = await pool.query("SELECT * FROM afk_users");
  return r.rows;
}

// ─── Sticky Messages ───────────────────────────────────────────────────────────────
export async function upsertSticky(guildId, channelId, data) {
  const { title, content, color, sticky_type } = data;
  await pool.query(
    `INSERT INTO sticky_messages (guild_id, channel_id, title, content, color, sticky_type)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (guild_id, channel_id) DO UPDATE SET title=$3, content=$4, color=$5, sticky_type=$6`,
    [guildId, channelId, title || null, content, color || 15228247, sticky_type || "embed"]
  );
}
export async function updateStickyLastMessage(guildId, channelId, messageId) {
  await pool.query(
    "UPDATE sticky_messages SET last_message_id=$3 WHERE guild_id=$1 AND channel_id=$2",
    [guildId, channelId, messageId]
  );
}
export async function deleteSticky(guildId, channelId) {
  await pool.query("DELETE FROM sticky_messages WHERE guild_id=$1 AND channel_id=$2", [guildId, channelId]);
}
export async function getAllSticky() {
  const r = await pool.query("SELECT * FROM sticky_messages");
  return r.rows;
}

// ─── Tickets ─────────────────────────────────────────────────────────────────────────────────
export async function upsertTicket(ticket) {
  await pool.query(
    `INSERT INTO tickets (id, channel_id, guild_id, user_id, type, reason, open, opened_at, members)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (id) DO UPDATE SET open=$7, members=$9`,
    [ticket.id, ticket.channelId, ticket.guildId, ticket.userId,
     ticket.type, ticket.reason, ticket.open, ticket.openedAt,
     JSON.stringify(ticket.members)]
  );
}
export async function closeTicketDb(ticketId) {
  await pool.query("UPDATE tickets SET open=false WHERE id=$1", [ticketId]);
}
export async function deleteTicketDb(ticketId) {
  await pool.query("DELETE FROM tickets WHERE id=$1", [ticketId]);
}
export async function getAllTickets() {
  const r = await pool.query("SELECT * FROM tickets WHERE open=true");
  return r.rows;
}

// ─── Giveaways ─────────────────────────────────────────────────────────────────────────────────
export async function upsertGiveaway(g) {
  await pool.query(
    `INSERT INTO giveaways (message_id, prize, winner_count, end_time, host_id, guild_id, channel_id, ended, winners, entrants)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (message_id) DO UPDATE SET ended=$8, winners=$9, entrants=$10`,
    [g.messageId, g.prize, g.winnerCount, g.endTime, g.hostId, g.guildId,
     g.channelId, g.ended, JSON.stringify(g.winners||[]), JSON.stringify([...(g.entrants||[])])]
  );
}
export async function getAllGiveaways() {
  const r = await pool.query("SELECT * FROM giveaways");
  return r.rows;
}

// ─── User Activity ───────────────────────────────────────────────────────────────────
export async function upsertUserActivity(guildId, userId, timestamp) {
  await pool.query(
    `INSERT INTO user_activity (guild_id, user_id, last_active, message_count)
     VALUES ($1, $2, $3, 1)
     ON CONFLICT (guild_id, user_id) DO UPDATE SET last_active = $3, message_count = user_activity.message_count + 1`,
    [guildId, userId, timestamp]
  );
}
export async function getUserActivity(guildId, userId, since) {
  const r = await pool.query(
    `SELECT * FROM user_activity WHERE guild_id = $1 AND user_id = $2 AND last_active >= $3`,
    [guildId, userId, since]
  );
  return r.rows[0] || null;
}

// ─── Music Plays ───────────────────────────────────────────────────────────────────
export async function recordMusicPlay(userId, guildId, trackTitle, trackUri, artist, duration) {
  await pool.query(
    `INSERT INTO music_plays (user_id, guild_id, track_title, track_uri, artist, duration, played_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [userId, guildId, trackTitle, trackUri, artist, duration]
  );
}
export async function getUserPlayStats(userId, guildId, limit = 50) {
  const total = await pool.query(
    `SELECT COUNT(*) as total FROM music_plays WHERE user_id = $1 AND guild_id = $2`,
    [userId, guildId]
  );
  const top = await pool.query(
    `SELECT track_title, artist, COUNT(*) as plays, MAX(played_at) as last_played
     FROM music_plays WHERE user_id = $1 AND guild_id = $2
     GROUP BY track_title, artist ORDER BY plays DESC, last_played DESC LIMIT $3`,
    [userId, guildId, limit]
  );
  return { total: parseInt(total.rows[0].total, 10), top: top.rows };
}
export async function getGuildPlayStats(guildId, limit = 50) {
  const total = await pool.query(
    `SELECT COUNT(*) as total FROM music_plays WHERE guild_id = $1`,
    [guildId]
  );
  const top = await pool.query(
    `SELECT track_title, artist, COUNT(*) as plays, COUNT(DISTINCT user_id) as unique_listeners
     FROM music_plays WHERE guild_id = $1
     GROUP BY track_title, artist ORDER BY plays DESC LIMIT $2`,
    [guildId, limit]
  );
  return { total: parseInt(total.rows[0].total, 10), top: top.rows };
}

// ─── Triggers ─────────────────────────────────────────────────────────────────────────────────
export async function upsertTrigger(guildId, phrase, response, exact) {
  await pool.query(
    `INSERT INTO triggers (guild_id, phrase, response, exact) VALUES ($1,$2,$3,$4)
     ON CONFLICT (guild_id, phrase) DO UPDATE SET response=$3, exact=$4`,
    [guildId, phrase, response, exact]
  );
}
export async function deleteTrigger(guildId, phrase) {
  await pool.query("DELETE FROM triggers WHERE guild_id=$1 AND phrase=$2", [guildId, phrase]);
}
export async function getAllTriggers() {
  const r = await pool.query("SELECT * FROM triggers");
  return r.rows;
}

// ─── Countdowns ─────────────────────────────────────────────────────────────────────────────────
export async function upsertCountdown(guildId, data) {
  await pool.query(
    `INSERT INTO countdowns (guild_id, name, unix_ts, description, pinned_channel_id, pinned_message_id)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (guild_id) DO UPDATE SET name=$2, unix_ts=$3, description=$4, pinned_channel_id=$5, pinned_message_id=$6`,
    [guildId, data.name, data.unixTs, data.description||null, data.pinnedChannelId||null, data.pinnedMessageId||null]
  );
}
export async function getAllCountdowns() {
  const r = await pool.query("SELECT * FROM countdowns");
  return r.rows;
}

// ─── Warnings ───────────────────────────────────────────────────────────────────────────────────────
export async function addWarning(guildId, userId, moderatorId, reason, points = 1) {
  const r = await pool.query(
    "INSERT INTO warnings (guild_id, user_id, moderator_id, reason, points) VALUES ($1,$2,$3,$4,$5) RETURNING *",
    [guildId, userId, moderatorId, reason, points]
  );
  return r.rows[0];
}
export async function getWarnings(guildId, userId) {
  const r = await pool.query(
    "SELECT * FROM warnings WHERE guild_id=$1 AND user_id=$2 AND active=true ORDER BY created_at DESC",
    [guildId, userId]
  );
  return r.rows;
}
export async function getTotalWarnPoints(guildId, userId) {
  const r = await pool.query(
    "SELECT COALESCE(SUM(points),0) AS total FROM warnings WHERE guild_id=$1 AND user_id=$2 AND active=true",
    [guildId, userId]
  );
  return parseInt(r.rows[0].total);
}
export async function clearWarnings(guildId, userId) {
  await pool.query("UPDATE warnings SET active=false WHERE guild_id=$1 AND user_id=$2", [guildId, userId]);
}
export async function removeWarning(warnId) {
  await pool.query("UPDATE warnings SET active=false WHERE id=$1", [warnId]);
}
export async function getAllWarnings(guildId) {
  const r = await pool.query(
    "SELECT * FROM warnings WHERE guild_id=$1 AND active=true ORDER BY created_at DESC",
    [guildId]
  );
  return r.rows;
}

// ─── Economy (user-wide, cross-server) ─────────────────────────────────────────────────────────
export async function getEconomy(userId) {
  const r = await pool.query("SELECT * FROM economy_users WHERE user_id=$1", [userId]);
  if (r.rows[0]) return r.rows[0];
  await pool.query(
    "INSERT INTO economy_users (user_id) VALUES ($1) ON CONFLICT DO NOTHING",
    [userId]
  );
  return {
    user_id: userId,
    coins: 0, theater_credits: 0, fame: 0, exp: 0, level: 1, rank: "Stagehand",
    last_perform: 0, last_work: 0, last_daily: 0, daily_streak: 0, inventory: "[]",
  };
}
export async function updateEconomy(userId, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const setClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
  await pool.query(
    `INSERT INTO economy_users (user_id, ${keys.join(", ")})
     VALUES ($1, ${keys.map((_, i) => `$${i + 2}`).join(", ")})
     ON CONFLICT (user_id) DO UPDATE SET ${setClauses}`,
    [userId, ...keys.map(k => fields[k])]
  );
}
export async function getLeaderboard(field = "coins", limit = 10) {
  const ALLOWED = ["coins", "theater_credits", "fame", "exp", "level"];
  if (!ALLOWED.includes(field)) field = "coins";
  const r = await pool.query(
    `SELECT * FROM economy_users ORDER BY ${field} DESC LIMIT $1`,
    [limit]
  );
  return r.rows;
}

// ─── Counting ────────────────────────────────────────────────────────────────────────────────────
export async function getCountingConfig(guildId) {
  const r = await pool.query("SELECT * FROM counting_config WHERE guild_id=$1", [guildId]);
  return r.rows[0] || null;
}
export async function upsertCountingConfig(guildId, fields) {
  const { channel_id, current_count, high_score, last_user_id, failed_at } = fields;
  await pool.query(
    `INSERT INTO counting_config (guild_id, channel_id, current_count, high_score, last_user_id, failed_at)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (guild_id) DO UPDATE SET
       channel_id    = COALESCE($2, counting_config.channel_id),
       current_count = COALESCE($3, counting_config.current_count),
       high_score    = COALESCE($4, counting_config.high_score),
       last_user_id  = COALESCE($5, counting_config.last_user_id),
       failed_at     = COALESCE($6, counting_config.failed_at)`,
    [guildId, channel_id??null, current_count??null, high_score??null, last_user_id??null, failed_at??null]
  );
}
export async function getAllCountingConfigs() {
  const r = await pool.query("SELECT * FROM counting_config");
  return r.rows;
}

export async function ensureTables() {
  const schema = `
    CREATE TABLE IF NOT EXISTS user_activity (
      guild_id VARCHAR(50) NOT NULL,
      user_id VARCHAR(50) NOT NULL,
      last_active BIGINT NOT NULL DEFAULT 0,
      message_count INT NOT NULL DEFAULT 0,
      PRIMARY KEY (guild_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS music_plays (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(50) NOT NULL,
      guild_id VARCHAR(50) NOT NULL,
      track_title VARCHAR(500) NOT NULL,
      track_uri VARCHAR(500),
      artist VARCHAR(500),
      duration BIGINT,
      played_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_music_plays_user ON music_plays(user_id, guild_id);
    CREATE INDEX IF NOT EXISTS idx_music_plays_guild ON music_plays(guild_id);
  `;
  await pool.query(schema);

  // ─── Migrate economy from guild-scoped to user-wide ─────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS economy_users (
      user_id VARCHAR(50) PRIMARY KEY,
      coins BIGINT DEFAULT 0,
      theater_credits BIGINT DEFAULT 0,
      fame BIGINT DEFAULT 0,
      exp BIGINT DEFAULT 0,
      level INT DEFAULT 1,
      rank VARCHAR(50) DEFAULT 'Stagehand',
      last_work BIGINT DEFAULT 0,
      last_perform BIGINT DEFAULT 0,
      last_daily BIGINT DEFAULT 0,
      daily_streak INT DEFAULT 0,
      inventory TEXT DEFAULT '[]'
    )
  `);

  // One-time migration: for each user, keep the best guild record (highest level → exp → coins)
  const oldRows = await pool.query("SELECT * FROM economy").catch(() => ({ rows: [] }));
  if (oldRows.rows.length > 0) {
    const byUser = new Map();
    for (const row of oldRows.rows) {
      const uid = row.user_id;
      const existing = byUser.get(uid);
      if (!existing) {
        byUser.set(uid, row);
      } else {
        const score = r => (Number(r.level || 1) * 1_000_000) + (Number(r.exp || 0) * 1_000) + Number(r.coins || 0);
        if (score(row) > score(existing)) byUser.set(uid, row);
      }
    }
    for (const [uid, row] of byUser) {
      await pool.query(
        `INSERT INTO economy_users (user_id, coins, theater_credits, fame, exp, level, rank, last_work, last_perform, last_daily, daily_streak, inventory)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (user_id) DO NOTHING`,
        [uid, row.coins || 0, row.theater_credits || 0, row.fame || 0, row.exp || 0, row.level || 1,
         row.rank || 'Stagehand', row.last_work || 0, row.last_perform || 0, row.last_daily || 0,
         row.daily_streak || 0, row.inventory || '[]']
      );
    }
    console.log(`\u2705 Migrated ${byUser.size} users from guild-scoped economy to user-wide economy_users`);
  }

  // Ensure guild_settings has drops_channel_id column (nullable)
  await pool.query(`
    ALTER TABLE guild_settings
    ADD COLUMN IF NOT EXISTS drops_channel_id VARCHAR(50)
  `).catch(() => {});

  // Ensure music_connections table for Last.fm / Spotify linking
  await pool.query(`
    CREATE TABLE IF NOT EXISTS music_connections (
      user_id VARCHAR(50) PRIMARY KEY,
      lastfm_username VARCHAR(100),
      lastfm_session_key VARCHAR(200),
      spotify_access_token VARCHAR(500),
      spotify_refresh_token VARCHAR(500),
      spotify_expires_at BIGINT DEFAULT 0,
      connected_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});

  console.log("\u2705 Auto-created user_activity, music_plays, economy_users tables; migration complete");
}

export async function getMusicConnection(userId) {
  const r = await pool.query("SELECT * FROM music_connections WHERE user_id=$1", [userId]);
  return r.rows[0] || null;
}
export async function setLastFmConnection(userId, username, sessionKey) {
  await pool.query(
    `INSERT INTO music_connections (user_id, lastfm_username, lastfm_session_key)
     VALUES ($1,$2,$3)
     ON CONFLICT (user_id) DO UPDATE SET lastfm_username=$2, lastfm_session_key=$3, connected_at=NOW()`,
    [userId, username, sessionKey]
  );
}
export async function setSpotifyConnection(userId, accessToken, refreshToken, expiresAt) {
  await pool.query(
    `INSERT INTO music_connections (user_id, spotify_access_token, spotify_refresh_token, spotify_expires_at)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id) DO UPDATE SET
       spotify_access_token=$2,
       spotify_refresh_token=$3,
       spotify_expires_at=$4,
       connected_at=NOW()`,
    [userId, accessToken, refreshToken, expiresAt]
  );
}
export async function getMusicConnectionsForUsers(userIds) {
  if (!userIds?.length) return [];
  const r = await pool.query(
    "SELECT * FROM music_connections WHERE user_id = ANY($1)",
    [userIds]
  );
  return r.rows;
}

export async function getCountingSaves(guildId, userId) {
  const r = await pool.query("SELECT * FROM counting_saves WHERE guild_id=$1 AND user_id=$2", [guildId, userId]);
  return r.rows[0] || { guild_id: guildId, user_id: userId, saves: 0, last_daily_claim: 0 };
}
export async function upsertCountingSaves(guildId, userId, fields) {
  const keys = Object.keys(fields);
  const setClauses = keys.map((k, i) => `${k} = $${i + 3}`).join(", ");
  await pool.query(
    `INSERT INTO counting_saves (guild_id, user_id, ${keys.join(", ")})
     VALUES ($1, $2, ${keys.map((_, i) => `$${i + 3}`).join(", ")})
     ON CONFLICT (guild_id, user_id) DO UPDATE SET ${setClauses}`,
    [guildId, userId, ...keys.map(k => fields[k])]
  );
}
export async function getGuildSaves(guildId) {
  const r = await pool.query("SELECT saves FROM counting_guild_saves WHERE guild_id=$1", [guildId]);
  return r.rows[0]?.saves || 0;
}
export async function setGuildSaves(guildId, saves) {
  await pool.query(
    `INSERT INTO counting_guild_saves (guild_id, saves) VALUES ($1,$2)
     ON CONFLICT (guild_id) DO UPDATE SET saves=$2`,
    [guildId, saves]
  );
}

// ─── Starboards ──────────────────────────────────────────────────────────────────────────────────────────────────────────
export async function createStarboard(guildId, name, emoji, channelId) {
  const r = await pool.query(
    `INSERT INTO starboards (guild_id, name, emoji, channel_id)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (guild_id, name) DO UPDATE SET
       emoji = EXCLUDED.emoji,
       channel_id = EXCLUDED.channel_id,
       enabled = true,
       updated_at = NOW()
     RETURNING *`,
    [guildId, name, emoji, channelId]
  );
  return r.rows[0];
}
export async function deleteStarboard(guildId, name) {
  await pool.query("DELETE FROM starboards WHERE guild_id=$1 AND name=$2", [guildId, name]);
}
export async function getStarboard(guildId, name) {
  const r = await pool.query("SELECT * FROM starboards WHERE guild_id=$1 AND name=$2", [guildId, name]);
  return r.rows[0] || null;
}
export async function getStarboardsByGuild(guildId) {
  const r = await pool.query("SELECT * FROM starboards WHERE guild_id=$1", [guildId]);
  return r.rows;
}
export async function getAllStarboards() {
  const r = await pool.query("SELECT * FROM starboards");
  return r.rows;
}
export async function updateStarboard(guildId, name, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const setClauses = keys.map((k, i) => `${k} = $${i + 3}`).join(", ");
  const vals = [guildId, name, ...keys.map(k => fields[k])];
  await pool.query(
    `UPDATE starboards SET ${setClauses}, updated_at = NOW() WHERE guild_id = $1 AND name = $2`,
    vals
  );
}
export async function getStarboardByEmoji(guildId, emoji) {
  const r = await pool.query("SELECT * FROM starboards WHERE guild_id=$1 AND emoji=$2", [guildId, emoji]);
  return r.rows[0] || null;
}

// ─── Starboard Entries ─────────────────────────────────────────────────────────────────────────────────────────────────
export async function getAllStarboardEntries() {
  const r = await pool.query("SELECT e.*, s.emoji FROM starboard_entries e JOIN starboards s ON e.starboard_id = s.id");
  return r.rows;
}
export async function upsertStarboardEntry(guildId, starboardId, channelId, messageId, starboardMsgId, starCount) {
  await pool.query(
    `INSERT INTO starboard_entries (guild_id, starboard_id, channel_id, message_id, starboard_msg_id, star_count)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (guild_id, starboard_id, message_id) DO UPDATE SET
       starboard_msg_id = $5,
       star_count = $6,
       updated_at = NOW()`,
    [guildId, starboardId, channelId, messageId, starboardMsgId, starCount]
  );
}
export async function updateStarboardEntry(guildId, starboardId, messageId, starCount, deleted = false) {
  if (deleted) {
    await pool.query(
      "DELETE FROM starboard_entries WHERE guild_id=$1 AND starboard_id=$2 AND message_id=$3",
      [guildId, starboardId, messageId]
    );
  } else {
    await pool.query(
      "UPDATE starboard_entries SET star_count=$4, updated_at=NOW() WHERE guild_id=$1 AND starboard_id=$2 AND message_id=$3",
      [guildId, starboardId, messageId, starCount]
    );
  }
}
export async function getStarboardEntries(guildId, starboardId) {
  const r = await pool.query(
    "SELECT * FROM starboard_entries WHERE guild_id=$1 AND starboard_id=$2",
    [guildId, starboardId]
  );
  return r.rows;
}
export async function getStarboardStats(guildId, starboardId) {
  const r1 = await pool.query(
    "SELECT COUNT(*) AS total FROM starboard_entries WHERE guild_id=$1 AND starboard_id=$2",
    [guildId, starboardId]
  );
  const r2 = await pool.query(
    "SELECT COALESCE(SUM(star_count),0) AS total FROM starboard_entries WHERE guild_id=$1 AND starboard_id=$2",
    [guildId, starboardId]
  );
  const r3 = await pool.query(
    "SELECT message_id, star_count FROM starboard_entries WHERE guild_id=$1 AND starboard_id=$2 ORDER BY star_count DESC LIMIT 1",
    [guildId, starboardId]
  );
  return {
    total: parseInt(r1.rows[0].total),
    totalStars: parseInt(r2.rows[0].total),
    top: r3.rows[0] ? `Message ID: ${r3.rows[0].message_id} with ${r3.rows[0].star_count} stars` : "No entries yet",
  };
}

// ─── UID Registrations ───────────────────────────────────────────────────────────────────────────────────
export async function registerUidDb(discordId, uid) {
  await pool.query(
    "INSERT INTO uid_registrations (discord_id, uid) VALUES ($1,$2) ON CONFLICT (discord_id) DO UPDATE SET uid=$2, registered_at=NOW()",
    [discordId, uid]
  );
}
export async function getUidDb(discordId) {
  const r = await pool.query("SELECT uid FROM uid_registrations WHERE discord_id=$1", [discordId]);
  return r.rows[0]?.uid || null;
}

// ─── Startup Hydration ───────────────────────────────────────────────────────────────────────────────────────
export async function hydrateStore(store) {
  const [afk, sticky, tix, giveaways, trigs, cds, settings, countingRows, allStarboards, allEntries] = await Promise.all([
    getAllAfk(), getAllSticky(), getAllTickets(), getAllGiveaways(),
    getAllTriggers(), getAllCountdowns(), getAllGuildSettings(), getAllCountingConfigs(),
    getAllStarboards(), getAllStarboardEntries(),
  ]);

  for (const row of afk) {
    store.afkUsers.set(`${row.guild_id}:${row.user_id}`, {
      userId: row.user_id, guildId: row.guild_id, reason: row.reason, since: Number(row.since),
    });
  }
  for (const row of sticky) {
    store.stickyMessages.set(`${row.guild_id}:${row.channel_id}`, {
      title: row.title, content: row.content, color: row.color,
      lastMessageId: row.last_message_id, type: row.sticky_type || "embed",
    });
  }
  for (const row of tix) {
    store.tickets.set(row.id, {
      id: row.id, channelId: row.channel_id, guildId: row.guild_id,
      userId: row.user_id, type: row.type, reason: row.reason,
      open: row.open, openedAt: Number(row.opened_at), members: JSON.parse(row.members || "[]"),
    });
  }
  for (const row of giveaways) {
    const entrantList = JSON.parse(row.entrants || "[]");
    store.giveaways.set(row.message_id, {
      messageId: row.message_id, prize: row.prize,
      winnerCount: row.winner_count, endTime: Number(row.end_time),
      hostId: row.host_id, guildId: row.guild_id, channelId: row.channel_id,
      ended: row.ended, winners: JSON.parse(row.winners || "[]"), entrants: new Set(entrantList),
    });
  }
  for (const row of countingRows) {
    store.countingChannels.set(row.guild_id, {
      channelId: row.channel_id, currentCount: Number(row.current_count || 0),
      highScore: Number(row.high_score || 0), lastUserId: row.last_user_id, failedAt: Number(row.failed_at || 0),
    });
  }
  for (const row of trigs) {
    if (!store.triggers.has(row.guild_id)) store.triggers.set(row.guild_id, []);
    store.triggers.get(row.guild_id).push({ phrase: row.phrase, response: row.response, exact: row.exact });
  }
  for (const row of cds) {
    store.countdowns.set(row.guild_id, { name: row.name, unixTs: Number(row.unix_ts), description: row.description });
    if (row.pinned_channel_id) {
      store.pinnedCountdowns.set(row.guild_id, { channelId: row.pinned_channel_id, messageId: row.pinned_message_id });
    }
  }
  for (const row of allStarboards) {
    store.starboards.set(`${row.guild_id}:${row.emoji}`, {
      id: row.id,
      name: row.name,
      emoji: row.emoji,
      channelId: row.channel_id,
      threshold: row.threshold,
      selfStar: row.self_star,
      enabled: row.enabled,
      blacklist: JSON.parse(row.blacklist || "[]"),
    });
  }
  for (const row of allEntries) {
    store.starboardEntries.set(`${row.guild_id}:${row.emoji}:${row.message_id}`, {
      guildId: row.guild_id,
      starboardId: row.starboard_id,
      channelId: row.channel_id,
      messageId: row.message_id,
      starboardMsgId: row.starboard_msg_id,
      starCount: row.star_count,
    });
  }
  for (const row of settings) {
    if (row.drops_channel_id) store.dropChannels.set(row.guild_id, { channelId: row.drops_channel_id });

    if (row.admin_role_id) store.adminRoles.set(row.guild_id, row.admin_role_id);

    if (row.welcome_channel_id) {
      store.welcomeChannels.set(row.guild_id, {
        channelId:   row.welcome_channel_id,
        title:       row.welcome_title       || null,
        message:     row.welcome_description || null,
        color:       row.welcome_color       || 0xE84057,
        thumbnail:   row.welcome_thumbnail   || "avatar",
        image:       row.welcome_image_url   || null,
        showFields:  row.welcome_show_fields !== false,
      });
    }

    store.ticketConfig.set(row.guild_id, {
      supportCategoryId:     row.ticket_support_category,
      appealCategoryId:      row.ticket_appeal_category,
      partnershipCategoryId: row.ticket_partnership_category,
      staffRoleId:           row.staff_role_id,
      logChannelId:          row.ticket_log_channel,
    });
    store.loggingConfig.set(row.guild_id, {
      enabled:   row.logging_enabled,
      channelId: row.log_channel_id,
      events:    JSON.parse(row.log_events || "[]"),
    });
  }

  console.log(`✅ DB hydrated — afk:${afk.length} sticky:${sticky.length} tickets:${tix.length} giveaways:${giveaways.length} triggers:${trigs.length} counting:${countingRows.length} starboards:${allStarboards.length} entries:${allEntries.length}`);
}
