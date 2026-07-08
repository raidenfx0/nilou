import {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, StringSelectMenuBuilder,
  ButtonBuilder, ButtonStyle,
} from "discord.js";
import { NILOU_RED } from "../theme.js";

const SUPPORT_LINK = "https://discord.gg/9zB8bdmCj7";

const CATEGORIES = [
  { id: "general",    label: "General",    emoji: "📋", desc: "Bot info, utilities, and basic commands" },
  { id: "moderation", label: "Moderation", emoji: "🔒", desc: "Manage users, warnings, and logs" },
  { id: "economy",    label: "Economy",    emoji: "💵", desc: "Coins, credits, shop, and daily rewards" },
  { id: "gambling",   label: "Gambling",   emoji: "🎰", desc: "Games of chance and betting" },
  { id: "genshin",    label: "Genshin",    emoji: "⚔️", desc: "Builds, artifacts, and UID registration" },
  { id: "management", label: "Management", emoji: "⚙️", desc: "Giveaways, tickets, roles, and automation" },
  { id: "counting",   label: "Counting",   emoji: "⌨️", desc: "Counting game with save mechanics" },
  { id: "music",      label: "Music",      emoji: "🎵", desc: "Playback, queue, and listening stats" },
  { id: "security",   label: "Security",   emoji: "🛡️", desc: "Ghost ping alerts and reaction roles" },
];

const COMMANDS = {
  general: [
    { cmd: "about",      desc: "About Nilou Bot" },
    { cmd: "botinfo",    desc: "Bot statistics and uptime" },
    { cmd: "echo",       desc: "Send a message anonymously" },
    { cmd: "help",       desc: "View this command menu" },
    { cmd: "nilou",      desc: "Random Nilou image" },
    { cmd: "ping",       desc: "Check bot latency" },
    { cmd: "serverinfo", desc: "View server details" },
    { cmd: "countdown",  desc: "Create event countdown timers" },
    { cmd: "timestamp",  desc: "Generate Discord timestamps" },
    { cmd: "afk",        desc: "Set or clear AFK status" },
  ],
  moderation: [
    { cmd: "ban",      desc: "Ban a member from the server" },
    { cmd: "kick",     desc: "Kick a member from the server" },
    { cmd: "purge",    desc: "Bulk delete messages" },
    { cmd: "timeout",  desc: "Timeout a member" },
    { cmd: "warn",     desc: "Warn a member (point system)" },
    { cmd: "logging",  desc: "Configure event logging channels" },
    { cmd: "starboard", desc: "Set up reaction starboards" },
  ],
  economy: [
    { cmd: "economy balance",    desc: "Check your balance" },
    { cmd: "economy daily",      desc: "Claim daily reward with streaks" },
    { cmd: "economy perform",    desc: "Perform on stage for coins and fame" },
    { cmd: "economy work",       desc: "Work a shift (4h cooldown)" },
    { cmd: "economy profile",    desc: "View your theater profile" },
    { cmd: "economy shop",       desc: "Browse the item shop" },
    { cmd: "economy buy",        desc: "Purchase an item" },
    { cmd: "economy inventory",  desc: "View your inventory" },
    { cmd: "economy transfer",   desc: "Send coins to another user" },
    { cmd: "economy leaderboard", desc: "View top performers" },
    { cmd: "collect",            desc: "Grab a random theater drop" },
  ],
  gambling: [
    { cmd: "gamble bet",      desc: "Flip a coin for coins" },
    { cmd: "gamble slots",    desc: "Spin the slot machine" },
    { cmd: "gamble roulette", desc: "Play roulette" },
    { cmd: "gamble credits",  desc: "Bet Theater Credits" },
  ],
  genshin: [
    { cmd: "build",          desc: "Character build recommendations" },
    { cmd: "cv_calc",        desc: "Calculate artifact Crit Value" },
    { cmd: "list",           desc: "List registered UIDs" },
    { cmd: "register",       desc: "Register your Genshin UID" },
    { cmd: "top_artifacts",  desc: "View top artifact submissions" },
  ],
  management: [
    { cmd: "adminrole",      desc: "Set admin permission role" },
    { cmd: "drops",          desc: "Redirect theater drops to a channel" },
    { cmd: "giveaway",       desc: "Run a button-based giveaway" },
    { cmd: "role",           desc: "Assign or remove roles" },
    { cmd: "sticky set",     desc: "Set an embed sticky message" },
    { cmd: "sticky set-plain", desc: "Set a plain text sticky" },
    { cmd: "ticket",         desc: "Open a support ticket" },
    { cmd: "trigger",        desc: "Set auto-response triggers" },
    { cmd: "welcome",        desc: "Configure welcome messages" },
    { cmd: "embed",          desc: "Create a custom embed" },
  ],
  counting: [
    { cmd: "counting set",      desc: "Set the counting channel" },
    { cmd: "counting info",     desc: "View current count and high score" },
    { cmd: "counting save",     desc: "Claim, use, buy, or check saves" },
    { cmd: "counting donate",   desc: "Donate saves to the guild pool" },
    { cmd: "counting guild-save", desc: "Use a guild pool save" },
  ],
  music: [
    { cmd: "play",    desc: "Play a song or playlist" },
    { cmd: "pause",   desc: "Pause the player" },
    { cmd: "resume",  desc: "Resume playback" },
    { cmd: "skip",    desc: "Skip the current track" },
    { cmd: "stop",    desc: "Stop and clear the queue" },
    { cmd: "queue",   desc: "View the current queue" },
    { cmd: "volume",  desc: "Set the playback volume" },
    { cmd: "music stats",     desc: "View your listening statistics" },
    { cmd: "music toptracks", desc: "View server top tracks" },
    { cmd: "musichelp",       desc: "Full music command reference" },
  ],
  security: [
    { cmd: "ghostping",     desc: "Configure ghost ping detection" },
    { cmd: "reactionrole",  desc: "Set up reaction role menus" },
  ],
};

function buildOverviewEmbed() {
  const catLines = CATEGORIES.map(c => `${c.emoji} **${c.label}** — ${c.desc}`).join("\n");
  return new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle("Nilou Bot — Command Guide")
    .setDescription(
      `Select a category below to browse commands.\n\n${catLines}\n\n` +
      `Need help? [Join the support server](${SUPPORT_LINK}).`
    )
    .setFooter({ text: "Nilou Bot" })
    .setTimestamp();
}

function buildCategoryEmbed(catId, page = 0) {
  const cat = CATEGORIES.find(c => c.id === catId);
  const cmds = COMMANDS[catId] || [];
  const perPage = 10;
  const totalPages = Math.max(1, Math.ceil(cmds.length / perPage));
  const p = Math.min(page, totalPages - 1);
  const slice = cmds.slice(p * perPage, (p + 1) * perPage);

  const desc = slice.map(c => `\`/${c.cmd}\` — ${c.desc}`).join("\n");

  const embed = new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle(`${cat.emoji} ${cat.label}`)
    .setDescription(desc)
    .setFooter({ text: `Page ${p + 1} of ${totalPages} | [Support Server](${SUPPORT_LINK})` })
    .setTimestamp();

  return { embed, totalPages, p };
}

function buildSelectRow() {
  const select = new StringSelectMenuBuilder()
    .setCustomId("help_category")
    .setPlaceholder("Select a category...")
    .addOptions(
      CATEGORIES.map(c => ({
        label: c.label,
        value: c.id,
        description: c.desc,
        emoji: c.emoji,
      }))
    );
  return new ActionRowBuilder().addComponents(select);
}

function buildNavRow(catId, page, totalPages) {
  const prev = new ButtonBuilder()
    .setCustomId(`help_prev:${catId}:${page}`)
    .setEmoji("◀️")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page <= 0);
  const pageBtn = new ButtonBuilder()
    .setCustomId("help_page_indicator")
    .setLabel(`${page + 1} / ${totalPages}`)
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true);
  const next = new ButtonBuilder()
    .setCustomId(`help_next:${catId}:${page}`)
    .setEmoji("▶️")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page >= totalPages - 1);
  const close = new ButtonBuilder()
    .setCustomId("help_close")
    .setEmoji("❌")
    .setStyle(ButtonStyle.Danger);
  return new ActionRowBuilder().addComponents(prev, pageBtn, next, close);
}

export const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("View all available Nilou bot commands");

export async function execute(interaction) {
  const embed = buildOverviewEmbed();
  const row = buildSelectRow();
  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

export async function handleHelpSelect(interaction) {
  const catId = interaction.values[0];
  const { embed, totalPages } = buildCategoryEmbed(catId, 0);
  const navRow = buildNavRow(catId, 0, totalPages);
  const selectRow = buildSelectRow();

  await interaction.update({ embeds: [embed], components: [selectRow, navRow] });
}

export async function handleHelpButton(interaction) {
  const id = interaction.customId;

  if (id === "help_close") {
    await interaction.update({ content: "Help menu closed.", embeds: [], components: [] });
    return;
  }

  if (id === "help_page_indicator") {
    await interaction.deferUpdate();
    return;
  }

  let catId, page;
  if (id.startsWith("help_prev:")) {
    [, catId, page] = id.split(":");
    page = Math.max(0, Number(page) - 1);
  } else if (id.startsWith("help_next:")) {
    [, catId, page] = id.split(":");
    page = Number(page) + 1;
  } else {
    await interaction.deferUpdate();
    return;
  }

  const { embed, totalPages, p } = buildCategoryEmbed(catId, page);
  const navRow = buildNavRow(catId, p, totalPages);
  const selectRow = buildSelectRow();

  await interaction.update({ embeds: [embed], components: [selectRow, navRow] });
}
