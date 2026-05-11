import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { stickyMessages } from "../data/store.js";
import { upsertSticky, deleteSticky } from "../db/index.js";
import { NILOU_RED, FOOTER_STICKY, DIVIDER } from "../theme.js";
import { isAdmin, denyAdmin } from "../utils/adminCheck.js";

export const data = new SlashCommandBuilder()
  .setName("sticky")
  .setDescription("Manage sticky messages in this channel")
  .addSubcommand(sub =>
    sub.setName("set").setDescription("Set an embed sticky message")
      .addStringOption(o => o.setName("content").setDescription("Message body (use \\n for new lines)").setRequired(true))
      .addStringOption(o => o.setName("title").setDescription("Embed title").setRequired(false))
      .addStringOption(o => o.setName("color").setDescription("Hex color (e.g. #E84057)").setRequired(false))
      .addStringOption(o => o.setName("image").setDescription("Image URL for the embed").setRequired(false))
      .addStringOption(o => o.setName("thumbnail").setDescription("Thumbnail URL for the embed").setRequired(false))
      .addStringOption(o => o.setName("footer").setDescription("Footer text").setRequired(false))
  )
  .addSubcommand(sub =>
    sub.setName("set-plain").setDescription("Set a plain text sticky message (no embed)")
      .addStringOption(o => o.setName("content").setDescription("The text to stick (use \\n for new lines)").setRequired(true))
  )
  .addSubcommand(sub => sub.setName("remove").setDescription("Remove the sticky message from this channel"))
  .addSubcommand(sub => sub.setName("view").setDescription("Preview the current sticky message"));

export async function execute(interaction) {
  if (!isAdmin(interaction.member)) return denyAdmin(interaction);
  const sub = interaction.options.getSubcommand();
  const key = `${interaction.guildId}:${interaction.channelId}`;

  if (sub === "set") {
    const content   = interaction.options.getString("content").replace(/\\n/g, "\n");
    const title     = interaction.options.getString("title") || "📌 Pinned";
    const colorIn   = interaction.options.getString("color");
    const imageUrl  = interaction.options.getString("image");
    const thumbUrl  = interaction.options.getString("thumbnail");
    const footerTxt = interaction.options.getString("footer");
    let color = NILOU_RED;
    if (colorIn) { const p = parseInt(colorIn.replace("#", ""), 16); if (!isNaN(p)) color = p; }

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`📌 ✦ ${title}`)
      .setDescription(`${DIVIDER}\n${content}\n${DIVIDER}`)
      .setFooter({ text: footerTxt ? `📌 ${footerTxt}` : FOOTER_STICKY.text })
      .setTimestamp();

    if (imageUrl) embed.setImage(imageUrl);
    if (thumbUrl) embed.setThumbnail(thumbUrl);

    const sent = await interaction.channel.send({ embeds: [embed] });
    const data  = { content, title, color, lastMessageId: sent.id, type: "embed", image: imageUrl, thumbnail: thumbUrl, footer: footerTxt };
    stickyMessages.set(key, data);
    await upsertSticky(interaction.guildId, interaction.channelId, { content, title, color, sticky_type: "embed" });
    await interaction.reply({ content: "🌸 Embed sticky set! It will stay at the bottom of the channel.", ephemeral: true });

  } else if (sub === "set-plain") {
    const content = interaction.options.getString("content").replace(/\\n/g, "\n");
    const sent    = await interaction.channel.send(content);
    stickyMessages.set(key, { content, type: "plain", lastMessageId: sent.id });
    await upsertSticky(interaction.guildId, interaction.channelId, { content, title: "plain", color: 0, sticky_type: "plain" });
    await interaction.reply({ content: "🌸 Plain text sticky set!", ephemeral: true });

  } else if (sub === "remove") {
    if (!stickyMessages.has(key)) return interaction.reply({ content: "💧 No sticky message in this channel.", ephemeral: true });
    const sticky = stickyMessages.get(key);
    if (sticky.lastMessageId) {
      try { const old = await interaction.channel.messages.fetch(sticky.lastMessageId); await old?.delete(); } catch {}
    }
    stickyMessages.delete(key);
    await deleteSticky(interaction.guildId, interaction.channelId);
    await interaction.reply({ content: "✨ Sticky message removed.", ephemeral: true });

  } else if (sub === "view") {
    if (!stickyMessages.has(key)) return interaction.reply({ content: "💧 No sticky message in this channel.", ephemeral: true });
    const sticky = stickyMessages.get(key);
    const typeStr = sticky.type === "plain" ? "Plain text" : "Embed";
    await interaction.reply({ content: `📌 **Type:** ${typeStr}\n**Title:** ${sticky.title || "—"}\n**Content:**\n${sticky.content}`, ephemeral: true });
  }
}
