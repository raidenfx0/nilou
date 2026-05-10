import pg from "pg";
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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

// ─── AFK ──────────────────────────────────────────────────────────────────────

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

// ─── Sticky Messages ──────────────────────────────────────────────────────────

export async function upsertSticky(guildId, channelId, data) {
  const { title, content, color } = data;
  await pool.query(
    `INSERT INTO sticky_messages (guild_id, channel_id, title, content, color)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (guild_id, channel_id) DO UPDATE SET title=$3, content=$4, color=$5`,
    [guildId, channelId, title || null, content, color || 15228247]
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

// ─── Tickets ──────────────────────────────────────────────────────────────────

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

// ─── Giveaways ────────────────────────────────────────────────────────────────

export async function upsertGiveaway(g) {
  await pool.query(
    `INSERT INTO giveaways (message_id, prize, winner_count, end_time, host_id, guild_id, channel_id, ended, winners, entrants)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (message_id) DO UPDATE SET ended=$8, winners=$9, entrants=$10`,
    [g.messageId, g.prize, g.winnerCount, g.endTime, g.hostId, g.guildId,
     g.channelId, g.ended, JSON.stringify(g.winners||[]), JSON.stringify(g.entrants||[])]
  );
}

export async function getAllGiveaways() {
  const r = await pool.query("SELECT * FROM giveaways");
  return r.rows;
}

// ─── Triggers ─────────────────────────────────────────────────────────────────

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

// ─── Countdowns ───────────────────────────────────────────────────────────────

export async function upsertCountdown(guildId, data) {
  await pool.query(
    `INSERT INTO countdowns (guild_id, name, unix_ts, description, pinned_channel_id, pinned_message_id)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (guild_id) DO UPDATE SET name=$2, unix_ts=$3, description=$4, pinned_channel_id=$5, pinned_message_id=$6`,
    [guildId, data.name, data.unixTs, data.description||null,
     data.pinnedChannelId||null, data.pinnedMessageId||null]
  );
}

export async function getAllCountdowns() {
  const r = await pool.query("SELECT * FROM countdowns");
  return r.rows;
}

// ─── Warnings ─────────────────────────────────────────────────────────────────

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
  await pool.query(
    "UPDATE warnings SET active=false WHERE guild_id=$1 AND user_id=$2",
    [guildId, userId]
  );
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

// ─── Economy ──────────────────────────────────────────────────────────────────

export async function getEconomy(userId, guildId) {
  const r = await pool.query(
    "SELECT * FROM economy WHERE user_id=$1 AND guild_id=$2",
    [userId, guildId]
  );
  if (r.rows[0]) return r.rows[0];
  await pool.query(
    "INSERT INTO economy (user_id, guild_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
    [userId, guildId]
  );
  return { user_id: userId, guild_id: guildId, coins: 0, theater_credits: 0, fame: 0, exp: 0, level: 1, rank: "Beginner", last_perform: 0, inventory: "[]" };
}

export async function updateEconomy(userId, guildId, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const setClauses = keys.map((k, i) => `${k} = $${i + 3}`).join(", ");
  await pool.query(
    `INSERT INTO economy (user_id, guild_id, ${keys.join(", ")})
     VALUES ($1, $2, ${keys.map((_, i) => `$${i + 3}`).join(", ")})
     ON CONFLICT (user_id, guild_id) DO UPDATE SET ${setClauses}`,
    [userId, guildId, ...keys.map(k => fields[k])]
  );
}

export async function getLeaderboard(guildId, field = "coins", limit = 10) {
  const ALLOWED = ["coins", "theater_credits", "fame", "exp", "level"];
  if (!ALLOWED.includes(field)) field = "coins";
  const r = await pool.query(
    `SELECT * FROM economy WHERE guild_id=$1 ORDER BY ${field} DESC LIMIT $2`,
    [guildId, limit]
  );
  return r.rows;
}

// ─── UID Registrations ────────────────────────────────────────────────────────

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

// ─── Startup Hydration ────────────────────────────────────────────────────────

export async function hydrateStore(store) {
  const [afk, sticky, tix, giveaways, trigs, cds, settings] = await Promise.all([
    getAllAfk(),
    getAllSticky(),
    getAllTickets(),
    getAllGiveaways(),
    getAllTriggers(),
    getAllCountdowns(),
    getAllGuildSettings(),
  ]);

  for (const row of afk) {
    store.afkUsers.set(`${row.guild_id}:${row.user_id}`, {
      userId: row.user_id, guildId: row.guild_id,
      reason: row.reason, since: Number(row.since),
    });
  }

  for (const row of sticky) {
    store.stickyMessages.set(`${row.guild_id}:${row.channel_id}`, {
      title: row.title, content: row.content,
      color: row.color, lastMessageId: row.last_message_id,
    });
  }

  for (const row of tix) {
    store.tickets.set(row.id, {
      id: row.id, channelId: row.channel_id, guildId: row.guild_id,
      userId: row.user_id, type: row.type, reason: row.reason,
      open: row.open, openedAt: Number(row.opened_at),
      members: JSON.parse(row.members || "[]"),
    });
  }

  for (const row of giveaways) {
    store.giveaways.set(row.message_id, {
      messageId: row.message_id, prize: row.prize,
      winnerCount: row.winner_count, endTime: Number(row.end_time),
      hostId: row.host_id, guildId: row.guild_id, channelId: row.channel_id,
      ended: row.ended, winners: JSON.parse(row.winners || "[]"),
      entrants: JSON.parse(row.entrants || "[]"),
    });
  }

  for (const row of trigs) {
    if (!store.triggers.has(row.guild_id)) store.triggers.set(row.guild_id, []);
    store.triggers.get(row.guild_id).push({
      phrase: row.phrase, response: row.response, exact: row.exact,
    });
  }

  for (const row of cds) {
    store.countdowns.set(row.guild_id, {
      name: row.name, unixTs: Number(row.unix_ts), description: row.description,
    });
    if (row.pinned_channel_id) {
      store.pinnedCountdowns.set(row.guild_id, {
        channelId: row.pinned_channel_id, messageId: row.pinned_message_id,
      });
    }
  }

  for (const row of settings) {
    if (row.admin_role_id)   store.adminRoles.set(row.guild_id, row.admin_role_id);
    if (row.welcome_channel_id) store.welcomeChannels.set(row.guild_id, row.welcome_channel_id);
    store.ticketConfig.set(row.guild_id, {
      supportCategoryId:     row.ticket_support_category,
      appealCategoryId:      row.ticket_appeal_category,
      partnershipCategoryId: row.ticket_partnership_category,
      staffRoleId:           row.staff_role_id,
      logChannelId:          row.ticket_log_channel,
    });
    store.loggingConfig.set(row.guild_id, {
      enabled:    row.logging_enabled,
      channelId:  row.log_channel_id,
      events:     JSON.parse(row.log_events || "[]"),
    });
  }

  console.log(`✅ DB hydrated — afk:${afk.length} sticky:${sticky.length} tickets:${tix.length} giveaways:${giveaways.length} triggers:${trigs.length}`);
}
