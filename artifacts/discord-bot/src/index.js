import express from "express";
const app = express();

// This tells Render "I am alive!"
app.get("/", (req, res) => {
  res.send("Bot is running!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Keep-alive server is running on port ${PORT}`);
});

import {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  Events,
  EmbedBuilder,
  ActivityType,
} from "discord.js";
import { createServer } from "http";
import { Connectors } from "shoukaku";
import { Kazagumo, Plugins } from "kazagumo";

import { loadCommands } from "./handlers/commands.js";
import { loadEvents } from "./handlers/events.js";
import {
  tickets,
  ticketConfig,
  afkUsers,
  stickyMessages,
  welcomeChannels,
  adminRoles,
  botStats,
  giveaways,
  triggers,
  countdowns,
  pinnedCountdowns,
  loggingConfig,
  countingChannels,
  pendingDrops,
  starboards,
  starboardEntries,
} from "./data/store.js";
import { NILOU_RED, FOOTER_MAIN, DIVIDER } from "./theme.js";
import { isAdmin } from "./utils/adminCheck.js";
import { buildCountdownEmbed } from "./commands/countdown.js";
import { openTicket, closeTicket, closeEmbed } from "./commands/ticket.js";
import { handleGiveawayButton, restoreGiveawayTimers } from "./commands/giveaway.js";
import { handleHelpSelect, handleHelpButton } from "./commands/help.js";
import { updateVoiceStatus } from "./commands/music.js";
import {
  hydrateStore,
  upsertTrigger,
  deleteTrigger,
  getAllWarnings,
  upsertGuildSettings,
  getLeaderboard,
  ensureTables,
  recordMusicPlay,
  pool,
} from "./db/index.js";

const TOKEN = process.env.DISCORD_BOT_TOKEN;
if (!TOKEN) {
  console.error("❌ DISCORD_BOT_TOKEN is not set.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

/**
 * Lavalink Configuration - Local node first, then public fallback
 * Priority: localhost (co-hosted) → public nodes (failover)
 */
const LOCAL_PASSWORD = process.env.LAVALINK_PASSWORD || "niloubot-lavalink-2026";
const Nodes = [
  {
    name: "Nilou Local",
    url: "localhost:2333",
    auth: LOCAL_PASSWORD,
    secure: false,
  },
  {
    name: "AjieDev",
    url: "lava-v4.ajieblogs.eu.org:80",
    auth: "https://dsc.gg/ajidevserver",
    secure: false,
  },
  {
    name: "NexCloud Node",
    url: "n3.nexcloud.in:2026",
    auth: "nexcloud",
    secure: false
  },
  {
    name: "Serenetia",
    url: "lavalinkv4.serenetia.com:443",
    auth: "https://seretia.link/discord",
    secure: true,
  },
  {
    name: "lavalink-v4.triniumhost.com",
    url: "lavalink-v4.triniumhost.com:443",
    auth: "free",
    secure: true,
  }
];

/**
 * Initialize Kazagumo (Lavalink Wrapper)
 */
client.manager = new Kazagumo({
  defaultSearchEngine: "youtube",
  plugins: [
    new Plugins.PlayerMoved(client),
  ],
  send: (guildId, payload) => {
    const guild = client.guilds.cache.get(guildId);
    if (guild) guild.shard.send(payload);
  }
}, new Connectors.DiscordJS(client), Nodes, {
  reconnectTries: 5,
  reconnectInterval: 5000,
  moveOnDisconnect: true,
  restTimeout: 60000,
});

// --- Lavalink Event Handling ---
client.manager.shoukaku.on("ready", (name) => {
  console.log(`✅ Lavalink Node "${name}" is connected and ready! 🌸`);
});

client.manager.shoukaku.on("error", (name, error) => {
  console.error(`❌ Lavalink Node "${name}" encountered an error:`, error.message);
});

// IMPORTANT: This logs if a node gets disconnected
client.manager.shoukaku.on("close", (name, code, reason) => {
  console.warn(`⚠️ Lavalink Node "${name}" closed. Code: ${code}, Reason: ${reason || 'No reason'}`);
});

client.manager.on("playerStart", async (player, track) => {
  const channel = client.channels.cache.get(player.textId);
  const guildId = player?.guildId;
  const requester = track?.requester;
  const requesterId = requester?.id;

  // Build enriched embed
  let embedTitle = track.title;
  let embedArtist = track.author || "Unknown";
  let embedThumbnail = track.thumbnail || null;
  let embedAlbum = "";

  // Try Spotify enrichment for linked users
  if (requesterId) {
    try {
      const { getMusicConnection } = await import("./db/index.js");
      const conn = await getMusicConnection(requesterId);
      if (conn?.spotify_access_token && conn.spotify_expires_at > Date.now()) {
        const { searchTrack } = await import("./utils/spotify.js");
        const spTrack = await searchTrack(`${track.title} ${track.author || ""}`, conn.spotify_access_token);
        if (spTrack) {
          embedAlbum = spTrack.album?.name || "";
          embedThumbnail = spTrack.album?.images?.[0]?.url || embedThumbnail;
          embedArtist = spTrack.artists?.map(a => a.name).join(", ") || embedArtist;
          embedTitle = spTrack.name || embedTitle;
        }
      }
    } catch (e) {
      // non-fatal
    }
  }

  if (channel) {
    const { EmbedBuilder } = await import("discord.js");
    const { NILOU_RED, DIVIDER } = await import("./theme.js");
    const np = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle("🌸 ✦ Now Performing")
      .setDescription(
        `${DIVIDER}\n**${embedTitle}**\nby **${embedArtist}**${embedAlbum ? `\n*from ${embedAlbum}*` : ""}\n${DIVIDER}`
      )
      .setFooter({ text: `Requested by ${requester?.username || "Audience"}` });
    if (embedThumbnail) np.setThumbnail(embedThumbnail);
    channel.send({ embeds: [np] }).catch(() => {});
  }

  // VC status
  updateVoiceStatus(player, client, false, track);

  // Record play
  if (requesterId && guildId) {
    recordMusicPlay(requesterId, guildId, track.title, track.uri, track.author, track.duration || track.length)
      .catch(err => console.error("❌ Music play record failed:", err.message));
  }

  // Last.fm nowPlaying
  if (requesterId) {
    try {
      const { getMusicConnection } = await import("./db/index.js");
      const { updateNowPlaying, isConfigured } = await import("./utils/lastfm.js");
      const { getScrobbleState } = await import("./commands/scrobble.js");
      if (!isConfigured()) return;
      const conn = await getMusicConnection(requesterId);
      if (conn?.lastfm_session_key && getScrobbleState(guildId).enabled) {
        await updateNowPlaying(conn.lastfm_session_key, track.title, track.author || "Unknown", "", track.duration || track.length || 0);
      }
    } catch (e) {
      // non-fatal
    }
  }

  // Store start time for scrobble threshold
  player.data.set("_scrobbleStart", Date.now());
});

client.manager.on("playerEnd", async (player, track) => {
  updateVoiceStatus(player, client, true);

  // Scrobble to Last.fm if played long enough
  const start = player.data.get("_scrobbleStart");
  const duration = track?.duration || track?.length || 0;
  if (start && duration) {
    const played = Date.now() - start;
    const threshold = Math.min(30000, Math.floor(duration * 0.5));
    if (played >= threshold && played >= 5000) {
      const requesterId = track?.requester?.id;
      const guildId = player?.guildId;
      if (requesterId && guildId) {
        try {
          const { getMusicConnection } = await import("./db/index.js");
          const { scrobble, isConfigured } = await import("./utils/lastfm.js");
          const { getScrobbleState } = await import("./commands/scrobble.js");
          if (!isConfigured()) return;
          const conn = await getMusicConnection(requesterId);
          const state = getScrobbleState(guildId);
          if (conn?.lastfm_session_key && state.enabled) {
            await scrobble(conn.lastfm_session_key, track.title, track.author || "Unknown", "", duration);
            // Post to summary channel if configured
            if (state.channelId) {
              const summaryChannel = client.channels.cache.get(state.channelId);
              if (summaryChannel) {
                const { EmbedBuilder } = await import("discord.js");
                const { NILOU_RED } = await import("./theme.js");
                summaryChannel.send({
                  embeds: [
                    new EmbedBuilder()
                      .setColor(NILOU_RED)
                      .setDescription(`🎵 **${track.requester?.username || "Someone"}** scrobbled **${track.title}** to Last.fm`)
                  ]
                }).catch(() => {});
              }
            }
          }
        } catch (e) {
          // non-fatal
        }
      }
    }
  }
  player.data.delete("_scrobbleStart");
});

client.manager.on("playerEmpty", (player) => {
  updateVoiceStatus(player, client, true);
});

client.manager.on("error", (name, error) => {
  console.error(`❌ Kazagumo Error on node ${name}:`, error);
});

// Load handlers
loadCommands(client);
loadEvents(client);

const store = {
  afkUsers, stickyMessages, tickets, ticketConfig, giveaways,
  triggers, countdowns, pinnedCountdowns, adminRoles, welcomeChannels,
  loggingConfig, countingChannels, starboards, starboardEntries,
};

// Hydrate all in-memory maps from PostgreSQL before login
hydrateStore(store).catch(err => console.error("❌ DB hydration failed:", err));

// Auto-create new tables on startup
ensureTables().catch(err => console.error("❌ Table creation failed:", err));

const rest = new REST().setToken(TOKEN);

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`✅ Logged in as ${readyClient.user.tag}`);
  readyClient.user.setPresence({
    status: "online",
    activities: [{
      name: "Dancing in the theater",
      type: ActivityType.Streaming,
      url: "https://youtu.be/dQw4w9WgXcQ?si=h6aLaUHqzqVXRQ5r",
    }],
  });
  // Restore giveaway timers after restart (so active giveaways auto-end on time)
  restoreGiveawayTimers(readyClient);
  botStats.startTime = Date.now();

  // Cache custom emojis from the main server
  const { initEmojiCache } = await import("./utils/emojiCache.js");
  await initEmojiCache(readyClient); 

  const commandsJson = [...client.commands.values()].map((cmd) => cmd.data.toJSON());
  const appId = readyClient.user.id;

  try {
    console.log(`🔄 Registering ${commandsJson.length} commands globally...`);
    await rest.put(Routes.applicationCommands(appId), { body: commandsJson });
    console.log(`✅ Global commands registered!`);

    const guilds = readyClient.guilds.cache;
    for (const [guildId, guild] of guilds) {
      try {
        const guildCmds = await guild.commands.fetch();
        if (guildCmds.size > 0) {
          await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: [] });
          console.log(`🧹 Cleared duplicate guild commands for: ${guild.name}`);
        }
      } catch (err) {}
    }
  } catch (err) {
    console.error("❌ Failed to sync commands:", err.message);
  }
});

client.on(Events.GuildCreate, async (guild) => {
  console.log(`🌸 Joined new server: ${guild.name}. Using global commands.`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (command?.autocomplete) {
      try {
        await command.autocomplete(interaction);
      } catch {
        await interaction.respond([]).catch(() => {});
      }
    }
    return;
  }

  if (interaction.isStringSelectMenu() && interaction.customId === "help_category") {
    await handleHelpSelect(interaction);
    return;
  }

  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`Error in /${interaction.commandName}:`, err);
      const reply = {
        content: "❌ Something went wrong with this command.",
        ephemeral: true,
      };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply).catch(() => {});
      } else {
        await interaction.reply(reply).catch(() => {});
      }
    }
    return;
  }

  if (interaction.isButton()) {
    const id = interaction.customId;

    if (id === "btn_support" || id === "btn_appeal" || id === "btn_partnership") {
      const TYPE_MAP = {
        btn_support: "Support",
        btn_appeal: "Appeal",
        btn_partnership: "Partnership",
      };
      const type = TYPE_MAP[id];

      await interaction.deferReply({ ephemeral: true });

      const result = await openTicket({
        guild: interaction.guild,
        user: interaction.user,
        type,
        reason: "Opened via panel",
      });

      if (result.error) {
        await interaction.editReply({ content: `❌ ${result.error}` });
      } else {
        await interaction.editReply({
          content: `🌸 Your **${type}** ticket has been opened in ${result.channel}!`,
        });
      }
      return;
    }

    if (id.startsWith("gw_enter:") || id.startsWith("gw_leave:") || id.startsWith("gw_participants:")) {
      await handleGiveawayButton(interaction);
      return;
    }

    if (id.startsWith("help_")) {
      await handleHelpButton(interaction);
      return;
    }

    if (id === "connect_lastfm") {
      const url = (await import("./utils/lastfm.js")).getAuthUrl();
      await interaction.reply({
        content: `🎵 To connect Last.fm, visit this link and authorize the bot:\n**${url}**\n\nAfter authorizing, use **/scrobble on** to enable scrobbling.`,
        ephemeral: true,
      });
      return;
    }

    if (id === "connect_spotify") {
      const { getAuthUrl } = await import("../utils/spotify.js");
      const url = getAuthUrl(`${process.env.BASE_URL || "https://nilou-bot-dashboard.replit.app"}/spotify/callback`, interaction.user.id);
      await interaction.reply({
        content: `🎵 To connect Spotify, visit this link and authorize the bot:\n**${url}**\n\nAfter authorizing, your now-playing cards will show album art and rich metadata.`,
        ephemeral: true,
      });
      return;
    }

    if (id === "close_ticket" || id.startsWith("ticket_close:")) {
      const ticketId = `${interaction.guildId}:${interaction.channelId}`;
      const ticket = tickets.get(ticketId);

      if (!ticket || !ticket.open) {
        await interaction.reply({
          content: "❌ This ticket is already closed.",
          ephemeral: true,
        });
        return;
      }
      if (ticket.userId !== interaction.user.id && !isAdmin(interaction.member)) {
        await interaction.reply({
          content: "❌ Only the ticket owner or an admin can close this.",
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({ embeds: [closeEmbed(interaction.user)] });
      await closeTicket(
        interaction.channel,
        ticket,
        ticketId,
        interaction.user,
        interaction.guild,
      );
      return;
    }
  }
});

client.login(TOKEN);

/**
 * HTTP API SERVER LOGIC
 */
const BOT_API_PORT = 4001;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = req.url?.split("?")[0];

  if (req.method === "GET") {
    if (url === "/api/stats") {
      const uptime = Date.now() - botStats.startTime;
      const h = Math.floor(uptime / 3600000);
      const m = Math.floor((uptime % 3600000) / 60000);
      const s = Math.floor((uptime % 60000) / 1000);
      res.end(
        JSON.stringify({
          tag: client.user?.tag || "Nilou",
          status: client.isReady() ? "online" : "offline",
          uptime: `${h}h ${m}m ${s}s`,
          uptimeMs: uptime,
          guildCount: client.guilds.cache.size,
          ping: client.ws.ping,
        }),
      );
      return;
    }

    if (url === "/api/afk") {
      const list = [...afkUsers.entries()].map(([key, data]) => ({ key, ...data }));
      res.end(JSON.stringify(list));
      return;
    }

    if (url === "/api/tickets") {
      res.end(JSON.stringify([...tickets.values()]));
      return;
    }

    if (url === "/api/guilds") {
      const list = client.guilds.cache.map((g) => ({
        id: g.id,
        name: g.name,
        memberCount: g.memberCount,
        icon: g.iconURL(),
      }));
      res.end(JSON.stringify(list));
      return;
    }

    if (url === "/api/giveaways") {
      res.end(
        JSON.stringify(
          [...giveaways.values()].map((g) => ({
            messageId: g.messageId,
            prize: g.prize,
            winnerCount: g.winnerCount,
            endTime: g.endTime,
            hostId: g.hostId,
            guildId: g.guildId,
            channelId: g.channelId,
            ended: g.ended,
            winners: g.winners || [],
          })),
        ),
      );
      return;
    }

    if (url === "/api/triggers") {
      const result = {};
      for (const [guildId, list] of triggers) {
        result[guildId] = list;
      }
      res.end(JSON.stringify(result));
      return;
    }

    if (url === "/api/countdowns") {
      const result = {};
      for (const [guildId, data] of countdowns) {
        const pinned = pinnedCountdowns.get(guildId);
        result[guildId] = { ...data, pinned: pinned || null };
      }
      res.end(JSON.stringify(result));
      return;
    }

    if (url === "/api/settings") {
      const settings = {};
      for (const [guildId] of client.guilds.cache) {
        settings[guildId] = {
          adminRole: adminRoles.get(guildId) || null,
          welcomeChannel: welcomeChannels.get(guildId) || null,
          ticketConfig: ticketConfig.get(guildId) || null,
          stickyCount: [...stickyMessages.keys()].filter((k) => k.startsWith(guildId)).length,
          afkCount: [...afkUsers.keys()].filter((k) => k.startsWith(guildId)).length,
          openTickets: [...tickets.values()].filter((t) => t.guildId === guildId && t.open).length,
        };
      }
      res.end(JSON.stringify(settings));
      return;
    }

    if (url === "/api/stickies") {
      const list = [];
      for (const [key, data] of stickyMessages) {
        const [guildId, channelId] = key.split(":");
        list.push({ guildId, channelId, ...data });
      }
      res.end(JSON.stringify(list));
      return;
    }

    if (url?.startsWith("/api/warns/")) {
      const guildId = url.split("/api/warns/")[1];
      if (!guildId) { res.statusCode = 400; res.end(JSON.stringify({ error: "guildId required" })); return; }
      try {
        const warns = await getAllWarnings(guildId);
        res.end(JSON.stringify(warns));
      } catch { res.end(JSON.stringify([])); }
      return;
    }

    if (url === "/api/logging") {
      const result = {};
      for (const [guildId, cfg] of loggingConfig) {
        result[guildId] = cfg;
      }
      res.end(JSON.stringify(result));
      return;
    }

    if (url === "/api/counting") {
      const result = {};
      for (const [guildId, cfg] of countingChannels) {
        result[guildId] = cfg;
      }
      res.end(JSON.stringify(result));
      return;
    }

    if (url === "/api/starboard") {
      const result = {};
      for (const [key, cfg] of starboards) {
        const guildId = key.split(":")[0];
        if (!result[guildId]) result[guildId] = [];
        result[guildId].push(cfg);
      }
      res.end(JSON.stringify(result));
      return;
    }

    if (url?.startsWith("/api/economy/leaderboard/")) {
      const guildId = url.split("/api/economy/leaderboard/")[1];
      if (!guildId) { res.statusCode = 400; res.end(JSON.stringify({ error: "guildId required" })); return; }
      try {
        const rows = await getLeaderboard("coins", 10);
        res.end(JSON.stringify(rows));
      } catch { res.end(JSON.stringify([])); }
      return;
    }
  }

  if (req.method === "POST") {
    const body = await readBody(req);

    if (url === "/api/send-embed") {
      const {
        guildId,
        channelId,
        title,
        description,
        color,
        footer,
        image,
        thumbnail,
      } = body;
      if (!channelId || !title || !description) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "channelId, title, and description are required" }));
        return;
      }

      try {
        let channel;
        if (guildId) {
          const guild = await client.guilds.fetch(guildId);
          channel = await guild.channels.fetch(channelId);
        } else {
          channel = await client.channels.fetch(channelId);
        }

        const hexColor = color ? parseInt(color.replace("#", ""), 16) : NILOU_RED;
        const embed = new EmbedBuilder()
          .setColor(isNaN(hexColor) ? NILOU_RED : hexColor)
          .setTitle(`✦ ${title}`)
          .setDescription(description.replace(/\\n/g, "\n"))
          .setFooter(footer ? { text: `🌸 ${footer}` } : FOOTER_MAIN)
          .setTimestamp();

        if (image) embed.setImage(image);
        if (thumbnail) embed.setThumbnail(thumbnail);

        await channel.send({ embeds: [embed] });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    if (url === "/api/post-countdown") {
      const { guildId, channelId } = body;
      if (!guildId || !channelId) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "guildId and channelId required" }));
        return;
      }

      const cd = countdowns.get(guildId);
      if (!cd) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "No countdown set for this guild" }));
        return;
      }

      try {
        const guild = await client.guilds.fetch(guildId);
        const channel = await guild.channels.fetch(channelId);
        const msg = await channel.send({ embeds: [buildCountdownEmbed(cd)] });
        pinnedCountdowns.set(guildId, { channelId, messageId: msg.id });

        const { startPinInterval } = await import("./commands/countdown.js");
        await startPinInterval(client, guildId);

        res.end(JSON.stringify({ success: true, messageId: msg.id }));
      } catch (err) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    if (url === "/api/trigger/add") {
      const { guildId, phrase, response, exact } = body;
      if (!guildId || !phrase || !response) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "guildId, phrase, and response required" }));
        return;
      }
      if (!triggers.has(guildId)) triggers.set(guildId, []);
      const list = triggers.get(guildId);
      const idx = list.findIndex((t) => t.phrase === phrase.toLowerCase());
      if (idx !== -1) list.splice(idx, 1);
      const p = phrase.toLowerCase();
      const r = response.replace(/\\n/g, "\n");
      list.push({ phrase: p, response: r, exact: !!exact });
      triggers.set(guildId, list);
      await upsertTrigger(guildId, p, r, !!exact);
      res.end(JSON.stringify({ success: true }));
      return;
    }

    if (url === "/api/trigger/remove") {
      const { guildId, phrase } = body;
      if (!guildId || !phrase) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "guildId and phrase required" }));
        return;
      }
      const list = triggers.get(guildId) || [];
      triggers.set(guildId, list.filter((t) => t.phrase !== phrase.toLowerCase()));
      await deleteTrigger(guildId, phrase.toLowerCase());
      res.end(JSON.stringify({ success: true }));
      return;
    }

    if (url === "/api/logging/update") {
      const { guildId, enabled, channelId, events } = body;
      if (!guildId) { res.statusCode = 400; res.end(JSON.stringify({ error: "guildId required" })); return; }
      const current = loggingConfig.get(guildId) || { enabled: false, channelId: null, events: [] };
      if (enabled !== undefined) current.enabled = !!enabled;
      if (channelId !== undefined) current.channelId = channelId;
      if (events !== undefined) current.events = events;
      loggingConfig.set(guildId, current);
      await upsertGuildSettings(guildId, {
        logging_enabled: current.enabled,
        log_channel_id: current.channelId,
        log_events: JSON.stringify(current.events),
      });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    if (url === "/api/welcome/update") {
      const { guildId, channelId, title, message, color, thumbnail, image, showFields } = body;
      if (!guildId || !channelId) { res.statusCode = 400; res.end(JSON.stringify({ error: "guildId and channelId required" })); return; }
      const parsedColor = color ? parseInt(String(color).replace("#",""), 16) : 0xE84057;
      const config = {
        channelId,
        title:      title      || null,
        message:    message    || null,
        color:      isNaN(parsedColor) ? 0xE84057 : parsedColor,
        thumbnail:  thumbnail  || "avatar",
        image:      image      || null,
        showFields: showFields !== false,
      };
      welcomeChannels.set(guildId, config);
      await upsertGuildSettings(guildId, {
        welcome_channel_id:  channelId,
        welcome_title:       config.title,
        welcome_description: config.message,
        welcome_color:       config.color,
        welcome_thumbnail:   config.thumbnail,
        welcome_image_url:   config.image,
        welcome_show_fields: config.showFields,
      });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    if (url === "/api/welcome/get") {
      const { guildId } = body;
      if (!guildId) { res.statusCode = 400; res.end(JSON.stringify({ error: "guildId required" })); return; }
      const config = welcomeChannels.get(guildId) || null;
      res.end(JSON.stringify(config));
      return;
    }

    if (url === "/api/drops") {
      const list = [];
      for (const [channelId, drop] of pendingDrops) {
        list.push({ channelId, ...drop, remainingMs: Math.max(0, drop.expiry - Date.now()) });
      }
      res.end(JSON.stringify(list));
      return;
    }
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(BOT_API_PORT, "0.0.0.0", () => {
  console.log(`🌐 Bot HTTP API running on port ${BOT_API_PORT}`);
});