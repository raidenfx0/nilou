import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { stickyMessages } from "../data/store.js";
import { upsertSticky, deleteSticky } from "../db/index.js";
import { NILOU_RED, FOOTER_STICKY, DIVIDER } from "../theme.js";
import { isAdmin, denyAdmin } from "../utils/adminCheck.js";

export const data = new SlashCommandBuilder()
  .setName("sticky")
  .setDescription("Manage sticky messages in a channel")
  .addSubcommand(sub =>
    sub.setName("set").setDescription("Set a sticky message in this channel")
      .addStringOption(o => o.setName("content").setDescription("The sticky message content (use \\n for new lines)").setRequired(true))
      .addStringOption(o => o.setName("title").setDescription("Embed title").setRequired(false))
      .addStringOption(o => o.setName("color").setDescription("Hex color (e.g. #E84057)").setRequired(false))
  )
  .addSubcommand(sub => sub.setName("remove").setDescription("Remove the sticky message from this channel"))
  .addSubcommand(sub => sub.setName("view").setDescription("View the current sticky message"));

export async function execute(interaction) {
  if (!isAdmin(interaction.member)) return denyAdmin(interaction);
  const sub = interaction.options.getSubcommand();
  const key = `${interaction.guildId}:${interaction.channelId}`;

  if (sub === "set") {
    const content    = interaction.options.getString("content").replace(/\\n/g, "\n");
    const title      = interaction.options.getString("title") || "🌺 Pinned";
    const colorInput = interaction.options.getString("color");
    let color = NILOU_RED;
    if (colorInput) { const p = parseInt(colorInput.replace("#",""), 16); if (!isNaN(p)) color = p; }

    const embed = new EmbedBuilder().setColor(color)
      .setTitle(`📌 ✦ ${title}`)
      .setDescription(`${DIVIDER}\n${content}\n${DIVIDER}`)
      .setFooter(FOOTER_STICKY).setTimestamp();

    const sent = await interaction.channel.send({ embeds: [embed] });
    stickyMessages.set(key, { content, title, color, lastMessageId: sent.id });
    await upsertSticky(interaction.guildId, interaction.channelId, { content, title, color });

    await interaction.reply({ content: "🌸 Sticky message set! It stays at the bottom after every message.", ephemeral: true });

  } else if (sub === "remove") {
    if (!stickyMessages.has(key)) return interaction.reply({ content: "💧 No sticky message here.", ephemeral: true });
    const sticky = stickyMessages.get(key);
    if (sticky.lastMessageId) {
      try { const old = await interaction.channel.messages.fetch(sticky.lastMessageId); await old?.delete(); } catch {}
    }
    stickyMessages.delete(key);
    await deleteSticky(interaction.guildId, interaction.channelId);
    await interaction.reply({ content: "✨ Sticky message removed.", ephemeral: true });

  } else if (sub === "view") {
    if (!stickyMessages.has(key)) return interaction.reply({ content: "💧 No sticky message here.", ephemeral: true });
    const sticky = stickyMessages.get(key);
    await interaction.reply({ content: `📌 **${sticky.title}**:\n${sticky.content}`, ephemeral: true });
  }
}
