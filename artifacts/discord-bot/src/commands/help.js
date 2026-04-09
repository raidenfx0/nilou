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
        name: "🌷 General",
        value: [
          "`/ping` — Check bot latency",
          "`/botinfo` — About Nilou bot",
          "`/serverinfo` — Server statistics",
          "`/help` — This menu",
        ].join("\n"),
      },
      {
        name: "⏰ Timestamps & Embeds",
        value: [
          "`/timestamp` — Generate a dynamic Discord timestamp",
          "`/embed` — Send a styled embed message",
          "`/countdown` — Countdown to the Subzeruz Festival",
        ].join("\n"),
      },
      {
        name: "💤 AFK",
        value: [
          "`/afk set [reason]` — Set your AFK status",
          "`/afk clear` — Remove your AFK status",
        ].join("\n"),
      },
      {
        name: "🎟️ Tickets",
        value: [
          "`/ticket open [type] [reason]` — Open a support ticket",
          "`/ticket close` — Close the current ticket",
          "`/ticket add @user` — Add a user to the ticket",
          "`/ticket remove @user` — Remove a user from the ticket",
          "`/ticket setup` — Configure ticket categories (admin)",
        ].join("\n"),
      },
      {
        name: "🌺 Roles & Reactions",
        value: [
          "`/reactionrole` — Set up reaction roles (admin)",
        ].join("\n"),
      },
      {
        name: "📌 Messages",
        value: [
          "`/sticky` — Pin a sticky message in a channel (admin)",
        ].join("\n"),
      },
      {
        name: "👋 Welcome",
        value: [
          "`/welcome` — Configure welcome messages (admin)",
        ].join("\n"),
      },
      {
        name: "🔮 Other",
        value: [
          "`/ghostping` — Enable ghost ping detection (admin)",
          "`/adminrole` — Set the bot admin role (admin)",
        ].join("\n"),
      },
    )
    .setFooter(FOOTER_MAIN)
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
