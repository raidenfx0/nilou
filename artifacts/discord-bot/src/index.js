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
} from "./data/store.js";
import { NILOU_RED, FOOTER_MAIN, DIVIDER } from "./theme.js";
import { isAdmin } from "./utils/adminCheck.js";
import { buildCountdownEmbed } from "./commands/countdown.js";
import { openTicket, closeTicket, closeEmbed } from "./commands/ticket.js";

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
 * Lavalink Configuration - Multi-Node Failover
 * We use multiple public nodes so if one is offline, Nilou can still perform!
 */
const Nodes = [
  {
    name: "HeavenCloud",
    url: "89.106.84.59:4000", 
    auth: "heavencloud.in",    
    secure: false,             
  },
  {
    name: "AjieDev",
    url: "lava-v4.ajieblogs.eu.org:80", 
    auth: "https://dsc.gg/ajidevserver",    
    secure: false,             
  },
  {
    name: "Horizxon",
    url: "lava.horizxon.studio:80", 
    auth: "horizxon.studio",    
    secure: false,             
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
}, new Connectors.DiscordJS(client), Nodes);

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

client.manager.on("playerStart", (player, track) => {
  const channel = client.channels.cache.get(player.textId);
  if (channel) {
    channel.send(`🌸 ✦ Now performing: **${track.title}**`).catch(() => {});
  }
});

client.manager.on("error", (name, error) => {
  console.error(`❌ Kazagumo Error on node ${name}:`, error);
});

// Load handlers
loadCommands(client);
loadEvents(client);

const rest = new REST().setToken(TOKEN);

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`✅ Logged in as ${readyClient.user.tag}`);
  botStats.startTime = Date.now(); 

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
      list.push({
        phrase: phrase.toLowerCase(),
        response: response.replace(/\\n/g, "\n"),
        exact: !!exact,
      });
      triggers.set(guildId, list);
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
      triggers.set(
        guildId,
        list.filter((t) => t.phrase !== phrase.toLowerCase()),
      );
      res.end(JSON.stringify({ success: true }));
      return;
    }
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(BOT_API_PORT, "0.0.0.0", () => {
  console.log(`🌐 Bot HTTP API running on port ${BOT_API_PORT}`);
});