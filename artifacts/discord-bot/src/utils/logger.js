import { EmbedBuilder } from "discord.js";
import { loggingConfig } from "../data/store.js";
import { NILOU_RED } from "../theme.js";

const EVENT_LABELS = {
  messageDelete:  "💬 Message Deleted",
  messageUpdate:  "✏️ Message Edited",
  memberJoin:     "📥 Member Joined",
  memberLeave:    "📤 Member Left",
  banAdd:         "🔨 Member Banned",
  banRemove:      "🔓 Member Unbanned",
  warn:           "⚠️ Warning Issued",
  ticket:         "🎟️ Ticket Event",
  kick:           "👢 Member Kicked",
  roleAdd:        "🏷️ Role Added",
  roleRemove:     "🏷️ Role Removed",
};

export async function sendLog(guild, event, { title, description, fields = [], color } = {}) {
  const config = loggingConfig.get(guild.id);
  if (!config?.enabled) return;
  if (!config.channelId) return;

  const events = config.events || [];
  if (events.length > 0 && !events.includes(event)) return;

  try {
    const channel = await guild.channels.fetch(config.channelId).catch(() => null);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(color || NILOU_RED)
      .setTitle(title || EVENT_LABELS[event] || `📋 ${event}`)
      .setDescription(description || "No details.")
      .setTimestamp()
      .setFooter({ text: `🌸 Nilou Logs · ${event}` });

    if (fields.length) embed.addFields(fields);

    await channel.send({ embeds: [embed] });
  } catch {}
}
