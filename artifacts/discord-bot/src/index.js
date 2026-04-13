import express from "express";
import {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  Events,
  EmbedBuilder,
  MessageFlags, // Added for modern ephemeral handling
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
const PORT = process.env.PORT || 10000;

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

// --- 3. UNIFIED EXPRESS SERVER ---
const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/", (req, res) => {
  res.send("🌸 Nilou Bot is blooming and running!");
});

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

app.get("/api/tickets", (req, res) => res.json([...tickets.values()]));

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

    for (const [guildId, guild] of readyClient.guilds.cache) {
      try {
        const guildCmds = await guild.commands.fetch();
        if (guildCmds.size > 0) {
          await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: [] });
          console.log(`Sweep: Cleared guild commands for ${guild.name}`);
        }
      } catch (err) { /* Permission skip */ }
    }
    console.log(`✅ Command Sync Complete!`);
  } catch (err) {
    console.error("❌ Command Sync Error:", err.message);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (command?.autocomplete) {
      try { await command.autocomplete(interaction); } catch { await interaction.respond([]).catch(() => {}); }
    }
    return;
  }

  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`❌ Error in /${interaction.commandName}:`, err);
      const errPayload = { 
        content: "❌ Something went wrong with this command.", 
        flags: MessageFlags.Ephemeral // Modern way
      };
      if (interaction.replied || interaction.deferred) await interaction.followUp(errPayload).catch(() => {});
      else await interaction.reply(errPayload).catch(() => {});
    }
  }

  if (interaction.isButton()) {
    const id = interaction.customId;

    if (["btn_support", "btn_appeal", "btn_partnership"].includes(id)) {
      const type = id.replace("btn_", "").charAt(0).toUpperCase() + id.replace("btn_", "").slice(1);

      // Fix: Added flags and withResponse
      await interaction.deferReply({ flags: MessageFlags.Ephemeral, withResponse: true });

      const result = await openTicket({
        guild: interaction.guild,
        user: interaction.user,
        type,
        reason: "Opened via panel",
      });

      if (result.error) await interaction.editReply({ content: `❌ ${result.error}` });
      else await interaction.editReply({ content: `🌸 Your **${type}** ticket: ${result.channel}!` });
    }

    if (id === "close_ticket" || id.startsWith("ticket_close:")) {
      const ticketId = `${interaction.guildId}:${interaction.channelId}`;
      const ticket = tickets.get(ticketId);

      if (!ticket || !ticket.open) {
        return interaction.reply({ content: "❌ Already closed.", flags: MessageFlags.Ephemeral });
      }

      if (ticket.userId !== interaction.user.id && !isAdmin(interaction.member)) {
        return interaction.reply({ content: "❌ No permission.", flags: MessageFlags.Ephemeral });
      }

      await interaction.reply({ embeds: [closeEmbed(interaction.user)] });
      await closeTicket(interaction.channel, ticket, ticketId, interaction.user, interaction.guild);
    }
  }
});

client.login(TOKEN);