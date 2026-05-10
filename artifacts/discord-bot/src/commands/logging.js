import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { NILOU_RED, FOOTER_MAIN, DIVIDER } from "../theme.js";
import { isAdmin, denyAdmin } from "../utils/adminCheck.js";
import { loggingConfig } from "../data/store.js";
import { upsertGuildSettings } from "../db/index.js";

const ALL_EVENTS = ["messageDelete","messageUpdate","memberJoin","memberLeave","banAdd","banRemove","warn","ticket","kick","roleAdd","roleRemove"];

export const data = new SlashCommandBuilder()
  .setName("logging")
  .setDescription("Configure server logging")
  .addSubcommand(sub =>
    sub.setName("setup")
      .setDescription("Set the log channel and enable logging (admin only)")
      .addChannelOption(o => o.setName("channel").setDescription("Channel to send logs to").setRequired(true))
  )
  .addSubcommand(sub => sub.setName("enable").setDescription("Enable logging"))
  .addSubcommand(sub => sub.setName("disable").setDescription("Disable logging"))
  .addSubcommand(sub => sub.setName("status").setDescription("View current logging config"))
  .addSubcommand(sub =>
    sub.setName("events")
      .setDescription("Toggle specific log events on or off")
      .addStringOption(o =>
        o.setName("event")
          .setDescription("Event to toggle")
          .setRequired(true)
          .addChoices(...ALL_EVENTS.map(e => ({ name: e, value: e })))
      )
  );

export async function execute(interaction) {
  if (!isAdmin(interaction.member)) return denyAdmin(interaction);
  const sub     = interaction.options.getSubcommand();
  const guildId = interaction.guildId;

  const current = loggingConfig.get(guildId) || { enabled: false, channelId: null, events: [...ALL_EVENTS] };

  if (sub === "setup") {
    const channel = interaction.options.getChannel("channel");
    current.channelId = channel.id;
    current.enabled   = true;
    if (!current.events?.length) current.events = [...ALL_EVENTS];
    loggingConfig.set(guildId, current);
    await upsertGuildSettings(guildId, {
      log_channel_id:   channel.id,
      logging_enabled:  true,
      log_events:       JSON.stringify(current.events),
    });
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(NILOU_RED).setTitle("✦ Logging Configured")
        .setDescription(`${DIVIDER}\n🌸 Log channel: ${channel}\nLogging: **Enabled**\nTracking ${current.events.length} event types.\n${DIVIDER}`)
        .setFooter(FOOTER_MAIN).setTimestamp()],
      ephemeral: true,
    });
    return;
  }

  if (sub === "enable") {
    current.enabled = true;
    loggingConfig.set(guildId, current);
    await upsertGuildSettings(guildId, { logging_enabled: true });
    await interaction.reply({ content: "🌸 Logging enabled!", ephemeral: true });
    return;
  }

  if (sub === "disable") {
    current.enabled = false;
    loggingConfig.set(guildId, current);
    await upsertGuildSettings(guildId, { logging_enabled: false });
    await interaction.reply({ content: "🌸 Logging disabled.", ephemeral: true });
    return;
  }

  if (sub === "status") {
    const embed = new EmbedBuilder().setColor(NILOU_RED).setTitle("✦ Logging Status")
      .setDescription(
        `${DIVIDER}\n` +
        `Status: **${current.enabled ? "✅ Enabled" : "❌ Disabled"}**\n` +
        `Channel: ${current.channelId ? `<#${current.channelId}>` : "Not set"}\n` +
        `Events: ${(current.events||[]).join(", ") || "None"}\n` +
        `${DIVIDER}`
      )
      .setFooter(FOOTER_MAIN).setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (sub === "events") {
    const event  = interaction.options.getString("event");
    const events = current.events || [...ALL_EVENTS];
    const idx    = events.indexOf(event);
    let action;
    if (idx === -1) { events.push(event); action = "enabled"; }
    else            { events.splice(idx, 1); action = "disabled"; }
    current.events = events;
    loggingConfig.set(guildId, current);
    await upsertGuildSettings(guildId, { log_events: JSON.stringify(events) });
    await interaction.reply({ content: `🌸 Event \`${event}\` is now **${action}**.`, ephemeral: true });
    return;
  }
}
