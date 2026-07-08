import {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, StringSelectMenuBuilder,
  ButtonBuilder, ButtonStyle,
} from "discord.js";
import { NILOU_RED, FOOTER_MAIN, DIVIDER } from "../theme.js";
import { getEmojiString } from "../utils/emojiCache.js";

const SUPPORT_LINK = "https://discord.gg/9zB8bdmCj7";
const E = (name, fallback) => getEmojiString(name) || fallback;

const CATEGORIES = [
  { id: "general",    label: "General",    emoji: "🌸", desc: "Basic bot info and utilities" },
  { id: "moderation", label: "Moderation", emoji: "⚔️", desc: "Ban, kick, warn, purge, logging" },
  { id: "economy",    label: "Economy",    emoji: "💠", desc: "Coins, Theater Credits, shop, daily" },
  { id: "gambling",   label: "Gambling",   emoji: "🎲", desc: "Coin flip, slots, roulette" },
  { id: "genshin",    label: "Genshin",    emoji: "🎮", desc: "Builds, CV calc, artifact ranking" },
  { id: "management", label: "Management", emoji: "🎟️", desc: "Giveaways, tickets, roles, sticky, welcome" },
  { id: "counting",   label: "Counting",   emoji: "🔢", desc: "Counting game with saves" },
  { id: "music",      label: "Music",      emoji: "🎵", desc: "Play, pause, skip, queue, stats" },
  { id: "security",   label: "Security",   emoji: "🔮", desc: "Ghost pings, reaction roles" },
];

const COMMANDS = {
  general: [
    { cmd: "about",      desc: "About Nilou Bot" },
    { cmd: "botinfo",    desc: "Detailed bot statistics" },
    { cmd: "echo",       desc: "Send a message anonymously" },
    { cmd: "help",       desc: "Show this interactive menu" },
    { cmd: "nilou",      desc: "Random Nilou image" },
    { cmd: "ping",       desc: "Check connection latency" },
    { cmd: "serverinfo", desc: "View server details" },
    { cmd: "countdown",  desc: "Event countdown timers" },
    { cmd: "timestamp",  desc: "Discord timestamps" },
    { cmd: "afk",        desc: "Set/clear AFK status" },
  ],
  moderation: [
    { cmd: "ban",      desc: "Ban a member" },
    { cmd: "kick",     desc: "Kick a member" },
    { cmd: "purge",    desc: "Bulk delete messages" },
    { cmd: "timeout",  desc: "Mute a member" },
    { cmd: "warn",     desc: "Warn a member (with point system)" },
    { cmd: "logging",  desc: "Configure event logging" },
  ],
  economy: [
    { cmd: "economy balance",    desc: "Check coins, Credits, Fame" },
    { cmd: "economy daily",      desc: "Claim daily reward (streaks!)" },
    { cmd: "economy perform",    desc: "Perform on stage for coins & fame" },
    { cmd: "economy work",       desc: "Quick work shift (4h cooldown)" },
    { cmd: "economy profile",    desc: "Full theater profile" },
    { cmd: "economy shop",       desc: "Browse Menakeri's shop" },
    { cmd: "economy buy",        desc: "Buy an item" },
    { cmd: "economy inventory",  desc: "View inventory" },
    { cmd: "economy transfer",   desc: "Send coins to another user" },
    { cmd: "economy leaderboard", desc: "Top performers" },
    { cmd: "collect",            desc: "Grab a Theater drop (first wins!)" },
  ],
  gambling: [
    { cmd: "gamble bet",      desc: "Coin flip" },
    { cmd: "gamble slots",    desc: "Slot machine" },
    { cmd: "gamble roulette", desc: "Roulette table" },
    { cmd: "gamble credits",  desc: "Bet Theater Credits" },
  ],
  genshin: [
    { cmd: "build",          desc: "Character build suggestions" },
    { cmd: "cv_calc",        desc: "Calculate artifact Crit Value" },
    { cmd: "list",           desc: "List registered users" },
    { cmd: "register",       desc: "Register your UID" },
    { cmd: "top_artifacts",  desc: "View best artifacts" },
  ],
  management: [
    { cmd: "adminrole",      desc: "Set admin permissions" },
    { cmd: "giveaway",       desc: "Run giveaways (button-based)" },
    { cmd: "role",           desc: "Manage member roles" },
    { cmd: "sticky set",     desc: "Embed sticky message" },
    { cmd: "sticky set-plain", desc: "Plain text sticky" },
    { cmd: "ticket",         desc: "Support ticket system" },
    { cmd: "trigger",        desc: "Auto-response triggers" },
    { cmd: "welcome",        desc: "Configure welcome embeds" },
    { cmd: "embed",          desc: "Create custom embeds" },
  ],
  counting: [
    { cmd: "counting set",      desc: "Set counting channel" },
    { cmd: "counting info",     desc: "Current count & high score" },
    { cmd: "counting save",     desc: "Manage personal saves" },
    { cmd: "counting donate",   desc: "Donate to guild pool" },
    { cmd: "counting guild-save", desc: "Use guild pool save" },
  ],
  music: [
    { cmd: "play",    desc: "Play a song or playlist" },
    { cmd: "pause",   desc: "Pause the music" },
    { cmd: "resume",  desc: "Resume playback" },
    { cmd: "skip",    desc: "Skip current track" },
    { cmd: "stop",    desc: "Stop and clear queue" },
    { cmd: "queue",   desc: "View the queue" },
    { cmd: "volume",  desc: "Set volume" },
    { cmd: "music stats",     desc: "Your music listening stats" },
    { cmd: "music toptracks", desc: "Server top tracks" },
    { cmd: "musichelp",       desc: "Full music command list" },
  ],
  security: [
    { cmd: "ghostping",     desc: "Ghost ping detection" },
    { cmd: "reactionrole",  desc: "Reaction role assignment" },
  ],
};

function buildOverviewEmbed() {
  const catLines = CATEGORIES.map(c => `${c.emoji} **${c.label}** \u2014 ${c.desc}`).join("\n");
  return new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle("🌸 ✦ Nilou Command Guide")
    .setDescription(
      `${DIVIDER}\n` +
      `Welcome to the **Nilou Grand Theater**!\n` +
      `Choose a category below to explore commands~\n` +
      `${DIVIDER}\n${catLines}\n${DIVIDER}\n` +
      `[Support Server](${SUPPORT_LINK}) \u00b7 Need help? Join us! 🌸`
    )
    .setFooter({ text: "Nilou Bot ✦ Select a category below" })
    .setTimestamp();
}

function buildCategoryEmbed(catId, page = 0) {
  const cat = CATEGORIES.find(c => c.id === catId);
  const cmds = COMMANDS[catId] || [];
  const perPage = 10;
  const totalPages = Math.max(1, Math.ceil(cmds.length / perPage));
  const p = Math.min(page, totalPages - 1);
  const slice = cmds.slice(p * perPage, (p + 1) * perPage);

  const desc = slice.map(c => `\`/${c.cmd}\` \u2014 ${c.desc}`).join("\n") || "No commands in this category.";

  return new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle(`${cat.emoji} ✦ ${cat.label} Commands`)
    .setDescription(`${DIVIDER}\n${desc}\n${DIVIDER}\nPage **${p + 1} / ${totalPages}**`)
    .setFooter({ text: `[Support Server](${SUPPORT_LINK}) \u00b7 Use the menu to switch categories` })
    .setTimestamp();
}

function buildOverviewRow() {
  const select = new StringSelectMenuBuilder()
    .setCustomId("help_category")
    .setPlaceholder("📑 Choose a category...")
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
  const indicator = new ButtonBuilder()
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
  return new ActionRowBuilder().addComponents(prev, indicator, next, close);
}

export const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("View all available Nilou bot commands");

export async function execute(interaction) {
  const embed = buildOverviewEmbed();
  const row = buildOverviewRow();
  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

export async function handleHelpSelect(interaction) {
  const catId = interaction.values[0];
  const cmds = COMMANDS[catId] || [];
  const perPage = 10;
  const totalPages = Math.max(1, Math.ceil(cmds.length / perPage));
  const page = 0;

  const embed = buildCategoryEmbed(catId, page);
  const navRow = buildNavRow(catId, page, totalPages);
  const selectRow = buildOverviewRow();

  await interaction.update({ embeds: [embed], components: [selectRow, navRow] });
}

export async function handleHelpButton(interaction) {
  const id = interaction.customId;

  if (id === "help_close") {
    await interaction.update({ content: "🌸 Help closed~", embeds: [], components: [] });
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

  const cmds = COMMANDS[catId] || [];
  const perPage = 10;
  const totalPages = Math.max(1, Math.ceil(cmds.length / perPage));
  page = Math.min(page, totalPages - 1);

  const embed = buildCategoryEmbed(catId, page);
  const navRow = buildNavRow(catId, page, totalPages);
  const selectRow = buildOverviewRow();

  await interaction.update({ embeds: [embed], components: [selectRow, navRow] });
}
