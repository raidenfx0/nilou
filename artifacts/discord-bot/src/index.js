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
import { loadCommands } from "./handlers/commands.js";
import { loadEvents } from "./handlers/events.js";
import { tickets, ticketConfig, afkUsers, stickyMessages, welcomeChannels, adminRoles, botStats } from "./data/store.js";
import { NILOU_RED, FOOTER_MAIN, DIVIDER } from "./theme.js";
import { isAdmin } from "./utils/adminCheck.js";

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
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

loadCommands(client);
loadEvents(client);

const rest = new REST().setToken(TOKEN);

async function registerCommandsToGuild(guildId, appId, commandsJson) {
  try {
    await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: commandsJson });
    console.log(`✅ Commands registered to guild ${guildId}`);
  } catch (err) {
    console.error(`❌ Failed to register to guild ${guildId}:`, err.message);
  }
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`✅ Logged in as ${readyClient.user.tag}`);

  const commandsJson = [...client.commands.values()].map((cmd) => cmd.data.toJSON());
  const appId = readyClient.user.id;

  try {
    await rest.put(Routes.applicationCommands(appId), { body: [] });
    console.log(`🧹 Cleared global commands`);
  } catch (err) {
    console.error("❌ Failed to clear global commands:", err.message);
  }

  const guilds = readyClient.guilds.cache;
  console.log(`🔄 Registering ${commandsJson.length} commands to ${guilds.size} server(s)...`);
  for (const [guildId] of guilds) {
    await registerCommandsToGuild(guildId, appId, commandsJson);
  }
  console.log(`✅ All guild commands registered!`);
});

client.on(Events.GuildCreate, async (guild) => {
  const commandsJson = [...client.commands.values()].map((cmd) => cmd.data.toJSON());
  console.log(`🌸 Joined new server: ${guild.name}`);
  await registerCommandsToGuild(guild.id, client.user.id, commandsJson);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`Error in /${interaction.commandName}:`, err);
      const reply = { content: "❌ Something went wrong with this command.", ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply).catch(() => {});
      } else {
        await interaction.reply(reply).catch(() => {});
      }
    }
    return;
  }

  if (interaction.isButton()) {
    const [action, ticketId] = interaction.customId.split(":");
    if (action === "ticket_close") {
      const ticket = tickets.get(ticketId);
      if (!ticket || !ticket.open) {
        await interaction.reply({ content: "❌ This ticket is already closed.", ephemeral: true });
        return;
      }
      if (ticket.userId !== interaction.user.id && !isAdmin(interaction.member)) {
        await interaction.reply({ content: "❌ Only the ticket owner or an admin can close this.", ephemeral: true });
        return;
      }
      ticket.open = false;
      tickets.set(ticketId, ticket);

      const closeEmbed = new EmbedBuilder()
        .setColor(NILOU_RED)
        .setTitle("✦ Ticket Closed")
        .setDescription(`${DIVIDER}\n🌸 Closed by ${interaction.user}.\nThis channel will be deleted in 5 seconds.\n${DIVIDER}`)
        .setFooter(FOOTER_MAIN)
        .setTimestamp();

      await interaction.reply({ embeds: [closeEmbed] });

      const config = ticketConfig.get(interaction.guildId);
      if (config?.logChannelId) {
        const logCh = interaction.guild.channels.cache.get(config.logChannelId);
        if (logCh) {
          logCh.send({
            embeds: [
              new EmbedBuilder()
                .setColor(NILOU_RED)
                .setTitle("✦ Ticket Closed")
                .setDescription(`Closed by: ${interaction.user.tag}\nChannel: <#${interaction.channelId}>`)
                .setFooter(FOOTER_MAIN)
                .setTimestamp(),
            ],
          }).catch(() => {});
        }
      }

      setTimeout(() => {
        interaction.channel.delete().catch(() => {});
        tickets.delete(ticketId);
      }, 5000);
    }
  }
});

client.login(TOKEN);

const BOT_API_PORT = 4001;

const server = createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const url = req.url?.split("?")[0];

  if (url === "/api/stats") {
    const uptime = Date.now() - botStats.startTime;
    const h = Math.floor(uptime / 3600000);
    const m = Math.floor((uptime % 3600000) / 60000);
    const s = Math.floor((uptime % 60000) / 1000);
    res.end(JSON.stringify({
      tag: client.user?.tag || "Nilou",
      status: client.isReady() ? "online" : "offline",
      uptime: `${h}h ${m}m ${s}s`,
      uptimeMs: uptime,
      guildCount: client.guilds.cache.size,
      ping: client.ws.ping,
    }));
    return;
  }

  if (url === "/api/afk") {
    const list = [];
    for (const [key, data] of afkUsers) {
      list.push({ key, ...data });
    }
    res.end(JSON.stringify(list));
    return;
  }

  if (url === "/api/tickets") {
    const list = [];
    for (const [id, ticket] of tickets) {
      list.push(ticket);
    }
    res.end(JSON.stringify(list));
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

  res.statusCode = 404;
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(BOT_API_PORT, "0.0.0.0", () => {
  console.log(`🌐 Bot HTTP API running on port ${BOT_API_PORT}`);
});
