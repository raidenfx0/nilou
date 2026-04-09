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

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`✅ Logged in as ${readyClient.user.tag}`);

  const commands = [...client.commands.values()].map((cmd) =>
    cmd.data.toJSON()
  );

  const rest = new REST().setToken(TOKEN);

  try {
    console.log(`🔄 Registering ${commands.length} slash commands globally...`);
    await rest.put(Routes.applicationCommands(readyClient.user.id), {
      body: commands,
    });
    console.log(`✅ Slash commands registered successfully.`);
  } catch (err) {
    console.error("❌ Failed to register slash commands:", err);
  }
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
