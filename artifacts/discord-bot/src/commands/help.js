import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { NILOU_RED, FOOTER_MAIN, DIVIDER } from "../theme.js";

export const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("View all available Nilou bot commands");

export async function execute(interaction) {
  const embed = new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle("✦ Nilou Command Guide")
    .setDescription(`${DIVIDER}\nAll commands for the Dancer of the Zubayr Theater!\n${DIVIDER}`)
    .addFields(
      {
        name: "🌷 General & Info",
        value: [
          "`/about` — About Nilou Bot",
          "`/botinfo` — Detailed bot statistics",
          "`/echo` — Send a message anonymously",
          "`/help` — Show this menu",
          "`/nilou` — Random Nilou image",
          "`/ping` — Check connection latency",
          "`/serverinfo` — View server details",
        ].join("\n"),
      },
      {
        name: "⚔️ Moderation",
        value: [
          "`/ban` — Ban a member",
          "`/kick` — Kick a member",
          "`/purge` — Bulk delete messages",
          "`/timeout` — Mute a member",
          "`/warn` — Warn a member (with point system)",
          "`/logging` — Configure event logging",
        ].join("\n"),
      },
      {
        name: "💠 Economy — Zubayr Theater",
        value: [
          "`/economy balance` — Check your coins & Credits",
          "`/economy daily` — Claim your daily reward (streak bonuses!)",
          "`/economy perform` — Perform on stage for coins & fame",
          "`/economy work` — Quick work shift (4h cooldown)",
          "`/economy profile [user]` — Full theater profile",
          "`/economy shop` — Browse Menakeri's shop",
          "`/economy buy <item>` — Buy an item",
          "`/economy inventory [user]` — View inventory",
          "`/economy transfer <user> <amount>` — Send coins",
          "`/economy leaderboard` — Top performers",
          "`/collect` — Grab a Theater drop (first wins!)",
        ].join("\n"),
      },
      {
        name: "🎲 Gambling Hall",
        value: [
          "`/gamble bet` — Coin flip",
          "`/gamble slots` — Slot machine",
          "`/gamble roulette` — Roulette table",
          "`/gamble credits` — Bet Theater Credits",
        ].join("\n"),
      },
      {
        name: "🎭 Profiles & Genshin",
        value: [
          "`/build` — Character build suggestions",
          "`/cv_calc` — Calculate artifact Crit Value",
          "`/list` — List registered users",
          "`/register` — Register your UID",
          "`/top_artifacts` — View best artifacts",
        ].join("\n"),
      },
      {
        name: "🎟️ Management & Utility",
        value: [
          "`/adminrole` — Set admin permissions (saves to DB)",
          "`/afk` — Set/clear AFK status",
          "`/countdown` — Event countdown timers",
          "`/embed` — Create custom embeds",
          "`/giveaway` — Run giveaways (button-based)",
          "`/role` — Manage member roles",
          "`/sticky set` — Embed sticky message",
          "`/sticky set-plain` — Plain text sticky",
          "`/ticket` — Support ticket system",
          "`/timestamp` — Discord timestamps",
          "`/trigger` — Auto-response triggers",
          "`/welcome` — Configure welcome embeds",
        ].join("\n"),
      },
      {
        name: "🔢 Counting Game",
        value: [
          "`/counting set <channel>` — Set counting channel",
          "`/counting info` — Current count & high score",
          "`/counting save claim` — Free daily save",
          "`/counting save use` — Use a personal save",
          "`/counting save buy` — Buy extra save (50 🎟️)",
          "`/counting save status` — Check your saves",
          "`/counting donate <n>` — Donate to guild pool",
          "`/counting guild-save` — Use guild pool save",
        ].join("\n"),
      },
      {
        name: "🎵 Music",
        value: [
          "`/play` — Play a song",
          "`/pause`, `/resume`, `/skip`, `/stop`",
          "`/queue` — View queue",
          "`/volume` — Set volume",
          "`/musichelp` — Full music command list",
        ].join("\n"),
      },
      {
        name: "🔮 Security & Roles",
        value: [
          "`/ghostping` — Ghost ping detection",
          "`/reactionrole` — Reaction role assignment",
        ].join("\n"),
      },
    )
    .setFooter(FOOTER_MAIN)
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
