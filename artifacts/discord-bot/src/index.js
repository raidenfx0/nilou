import {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  Events,
} from "discord.js";
import { loadCommands } from "./handlers/commands.js";
import { loadEvents } from "./handlers/events.js";

const TOKEN = process.env.DISCORD_BOT_TOKEN;
if (!TOKEN) {
  console.error("❌ DISCORD_BOT_TOKEN is not set. Please add it to your secrets.");
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
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
  ],
});

loadCommands(client);
loadEvents(client);

const rest = new REST().setToken(TOKEN);

async function registerCommandsToGuild(guildId, appId, commandsJson) {
  try {
    await rest.put(Routes.applicationGuildCommands(appId, guildId), {
      body: commandsJson,
    });
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

  console.log(`✅ All guild commands registered — commands are available immediately!`);
});

client.on(Events.GuildCreate, async (guild) => {
  const commandsJson = [...client.commands.values()].map((cmd) => cmd.data.toJSON());
  console.log(`🌸 Joined new server: ${guild.name} — registering commands...`);
  await registerCommandsToGuild(guild.id, client.user.id, commandsJson);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`Error in command /${interaction.commandName}:`, err);
    const reply = {
      content: "❌ An error occurred while running this command.",
      ephemeral: true,
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply).catch(() => {});
    } else {
      await interaction.reply(reply).catch(() => {});
    }
  }
});

client.login(TOKEN);
