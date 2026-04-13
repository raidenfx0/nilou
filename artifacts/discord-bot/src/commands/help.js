import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { NILOU_RED, FOOTER_MAIN, DIVIDER } from "../theme.js";

export const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("View all available Nilou bot commands");

export async function execute(interaction) {
  const embed = new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle("✦ Nilou Command Guide")
    .setDescription(`${DIVIDER}\nHere are all the things I can do for you! 🌸\n${DIVIDER}`)
    .addFields(
      {
        name: "🌷 General & Info",
        value: [
          "`/about` — Information about Nilou",
          "`/botinfo` — Detailed bot statistics",
          "`/echo` — Send a message anonymously",
          "`/help` — Show this menu",
          "`/nilou` — Get a random beautiful image of Nilou",
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
        ].join("\n"),
      },
      {
        name: "🎭 Profiles & Genshin",
        value: [
          "`/build` — Character build suggestions",
          "`/cv_calc` — Calculate artifact Crit Value",
          "`/list` — List registered users",
          "`/profile` — View user profile",
          "`/register` — Register your account",
          "`/top_artifacts` — View best artifacts",
        ].join("\n"),
      },
      {
        name: "🎟️ Management & Utility",
        value: [
          "`/adminrole` — Set admin permissions",
          "`/afk` — Manage AFK status",
          "`/countdown` — Event timers",
          "`/embed` — Create custom embeds",
          "`/giveaway` — Manage giveaways",
          "`/role` — Manage member roles",
          "`/sticky` — Create sticky messages",
          "`/ticket` — Support system",
          "`/timestamp` — Create Discord timestamps",
          "`/trigger` — Auto-response system",
          "`/welcome` — Join/Leave settings",
        ].join("\n"),
      },
      {
        name: "🔮 Security & Roles",
        value: [
          "`/ghostping` — Toggle ghost ping detection",
          "`/reactionrole` — Reaction-based role assignment",
        ].join("\n"),
      },
    )
    .setFooter(FOOTER_MAIN)
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}