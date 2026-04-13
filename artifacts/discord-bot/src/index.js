import express from "express";
import {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  Events,
  EmbedBuilder,
} from "discord.js";
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
import { NILOU_RED, FOOTER_MAIN } from "./theme.js";
import { isAdmin } from "./utils/adminCheck.js";
import { buildCountdownEmbed } from "./commands/countdown.js";
import { openTicket, closeTicket, closeEmbed } from "./commands/ticket.js";

// --- 1. ENVIRONMENT SETUP ---
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const PORT = process.env.PORT || 10000; // Render provides this

if (!TOKEN) {
  console.error("❌ DISCORD_BOT_TOKEN is not set.");
  process.exit(1);
}

// --- 2. DISCORD CLIENT SETUP ---
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

// --- 3. UNIFIED EXPRESS SERVER (Keep-alive + API) ---
const app = express();
app.use(express.json());

// CORS Middleware
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Root route for Render Health Check
app.get("/", (req, res) => {
  res.send("🌸 Nilou Bot is blooming and running!");
});

// Stats API
app.get("/api/stats", (req, res) => {
  const uptime = Date.now() - botStats.startTime;
  const h = Math.floor(uptime / 3600000);
  const m = Math.floor((uptime % 3600000) / 60000);
  const s = Math.floor((uptime % 60000) / 1000);
  res.json({
    tag: client.user?.tag || "Nilou",
    status: client.isReady() ? "online" : "offline",
    uptime: `${h}h ${m}m ${s}s`,
    guildCount: client.guilds.cache.size,
    ping: client.ws.ping,
  });
});

// Other API Routes
app.get("/api/tickets", (req, res) => res.json([...tickets.values()]));
app.get("/api/guilds", (req, res) => {
  res.json(client.guilds.cache.map(g => ({ id: g.id, name: g.name, memberCount: g.memberCount, icon: g.iconURL() })));
});

// POST: Send Embed
app.post("/api/send-embed", async (req, res) => {
  const { channelId, title, description, color, footer, image, thumbnail } = req.body;
  if (!channelId || !title || !description) return res.status(400).json({ error: "Missing fields" });

  try {
    const channel = await client.channels.fetch(channelId);
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
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start the unified server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Unified Server (Keep-alive + API) running on port ${PORT}`);
});

// --- 4. DISCORD EVENT HANDLERS ---
client.once(Events.ClientReady, async (readyClient) => {
  console.log(`✅ Logged in as ${readyClient.user.tag}`);

  const commandsJson = [...client.commands.values()].map((cmd) => cmd.data.toJSON());
  const appId = readyClient.user.id;

  try {
    console.log(`🔄 Syncing ${commandsJson.length} global commands...`);
    await rest.put(Routes.applicationCommands(appId), { body: commandsJson });

    // Cleanup Guild Commands to prevent "Double Commands"
    for (const [guildId, guild] of readyClient.guilds.cache) {
      try {
        const guildCmds = await guild.commands.fetch();
        if (guildCmds.size > 0) {
          await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: [] });
          console.log(`🧹 Cleaned duplicates in: ${guild.name}`);
        }
      } catch (err) { /* Skip if no permission */ }
    }
    console.log(`✅ Command Sync Complete!`);
  } catch (err) {
    console.error("❌ Command Sync Error:", err.message);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  // Autocomplete Handling
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (command?.autocomplete) {
      try { await command.autocomplete(interaction); } catch { await interaction.respond([]).catch(() => {}); }
    }
    return;
  }

  // Slash Command Handling
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`❌ Error in /${interaction.commandName}:`, err);
      const errPayload = { content: "❌ Something went wrong with this command.", ephemeral: true };
      if (interaction.replied || interaction.deferred) await interaction.followUp(errPayload).catch(() => {});
      else await interaction.reply(errPayload).catch(() => {});
    }
  }

  // Button Handling
  if (interaction.isButton()) {
    const id = interaction.customId;

    // Ticket Buttons
    if (["btn_support", "btn_appeal", "btn_partnership"].includes(id)) {
      const type = id.replace("btn_", "").charAt(0).toUpperCase() + id.replace("btn_", "").slice(1);
      await interaction.deferReply({ ephemeral: true });

      const result = await openTicket({
        guild: interaction.guild,
        user: interaction.user,
        type,
        reason: "Opened via panel",
      });

      if (result.error) await interaction.editReply({ content: `❌ ${result.error}` });
      else await interaction.editReply({ content: `🌸 Your **${type}** ticket: ${result.channel}!` });
    }

    // Close Ticket
    if (id === "close_ticket" || id.startsWith("ticket_close:")) {
      const ticketId = `${interaction.guildId}:${interaction.channelId}`;
      const ticket = tickets.get(ticketId);

      if (!ticket || !ticket.open) return interaction.reply({ content: "❌ Already closed.", ephemeral: true });
      if (ticket.userId !== interaction.user.id && !isAdmin(interaction.member)) {
        return interaction.reply({ content: "❌ No permission.", ephemeral: true });
      }

      await interaction.reply({ embeds: [closeEmbed(interaction.user)] });
      await closeTicket(interaction.channel, ticket, ticketId, interaction.user, interaction.guild);
    }
  }
});

client.login(TOKEN);