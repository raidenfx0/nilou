import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { countdowns, pinnedCountdowns } from "../data/store.js";
import { isAdmin, denyAdmin } from "../utils/adminCheck.js";
import { NILOU_RED, FOOTER_MAIN, DIVIDER } from "../theme.js";

export const data = new SlashCommandBuilder()
  .setName("countdown")
  .setDescription("Festival countdown timers")
  .addSubcommand((sub) =>
    sub
      .setName("set")
      .setDescription("Set a festival countdown (admin only)")
      .addStringOption((o) =>
        o.setName("name").setDescription("Festival name (e.g. Subzeruz Festival)").setRequired(true)
      )
      .addStringOption((o) =>
        o.setName("date").setDescription("Festival date/time (e.g. 2025-08-15 18:00)").setRequired(true)
      )
      .addStringOption((o) =>
        o.setName("description").setDescription("Short description of the festival").setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("show")
      .setDescription("Show the current festival countdown")
  )
  .addSubcommand((sub) =>
    sub
      .setName("pin")
      .setDescription("Post a live countdown embed that auto-updates (admin only)")
      .addChannelOption((o) =>
        o.setName("channel").setDescription("Channel to post the live countdown in").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("unpin")
      .setDescription("Stop the auto-updating countdown embed (admin only)")
  )
  .addSubcommand((sub) =>
    sub
      .setName("remove")
      .setDescription("Remove the festival countdown (admin only)")
  );

export function buildCountdownEmbed(data) {
  const { name, unixTs, description } = data;
  const now     = Math.floor(Date.now() / 1000);
  const diff    = unixTs - now;
  const started = diff <= 0;

  const totalDays  = Math.floor(Math.abs(diff) / 86400);
  const totalHours = Math.floor((Math.abs(diff) % 86400) / 3600);
  const totalMins  = Math.floor((Math.abs(diff) % 3600) / 60);
  const totalSecs  = Math.abs(diff) % 60;

  const timeBreakdown = started
    ? `The festival started <t:${unixTs}:R>!`
    : `**${totalDays}** days **${totalHours}** hours **${totalMins}** minutes **${totalSecs}** seconds`;

  return new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle(`🎊 ✦ ${name}`)
    .setDescription(
      `${DIVIDER}\n` +
      (description ? `${description}\n\n` : "") +
      (started
        ? "The festival has begun! May the waters of celebration flow freely~ 🌸"
        : "The stage is being prepared... The performers are ready... The audience awaits...") +
      `\n${DIVIDER}`
    )
    .addFields(
      {
        name: started ? "🎉 Festival Started" : "📅 Festival Date",
        value: `<t:${unixTs}:F>`,
        inline: true,
      },
      {
        name: started ? "⏱️ Time Since Start" : "⏳ Time Remaining",
        value: `<t:${unixTs}:R>`,
        inline: true,
      },
      { name: "🕐 Breakdown", value: timeBreakdown, inline: false },
      { name: "📌 Short Date", value: `<t:${unixTs}:d>`, inline: true },
      { name: "🗓️ Long Date", value: `<t:${unixTs}:D>`, inline: true },
    )
    .setFooter({ text: `🌸 Nilou • ${name} • Auto-updates every 5 min` })
    .setTimestamp();
}

const pinIntervals = new Map();

export async function startPinInterval(client, guildId) {
  if (pinIntervals.has(guildId)) {
    clearInterval(pinIntervals.get(guildId));
    pinIntervals.delete(guildId);
  }

  const pinned = pinnedCountdowns.get(guildId);
  if (!pinned) return;

  const interval = setInterval(async () => {
    const cd = countdowns.get(guildId);
    const pin = pinnedCountdowns.get(guildId);
    if (!cd || !pin) return;
    try {
      const channel = await client.channels.fetch(pin.channelId);
      const msg     = await channel.messages.fetch(pin.messageId);
      await msg.edit({ embeds: [buildCountdownEmbed(cd)] });
    } catch (err) {
      console.error("Pin update error:", err.message);
    }
  }, 5 * 60 * 1000);

  pinIntervals.set(guildId, interval);
}

export async function execute(interaction) {
  const sub     = interaction.options.getSubcommand();
  const guildId = interaction.guildId;

  if (sub === "set") {
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);

    const name        = interaction.options.getString("name");
    const dateInput   = interaction.options.getString("date");
    const description = interaction.options.getString("description") || null;

    const parsed = Date.parse(dateInput);
    if (isNaN(parsed)) {
      return interaction.reply({
        content: `💧 Nilou couldn't read that date. Try a format like \`2025-08-15\` or \`2025-08-15 18:00\`.`,
        ephemeral: true,
      });
    }

    const unixTs = Math.floor(parsed / 1000);
    countdowns.set(guildId, { name, unixTs, description });

    const embed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle("🌸 ✦ Festival Countdown Set")
      .setDescription(`**${name}** has been set!\nThe countdown begins now~`)
      .addFields(
        { name: "🗓️ Festival Date", value: `<t:${unixTs}:F>`, inline: true },
        { name: "⏳ Time Remaining", value: `<t:${unixTs}:R>`, inline: true },
      )
      .setFooter(FOOTER_MAIN)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (sub === "show") {
    const data = countdowns.get(guildId);
    if (!data) {
      return interaction.reply({
        content: "💧 No festival countdown has been set. Ask an admin to use `/countdown set` first!",
        ephemeral: true,
      });
    }
    await interaction.reply({ embeds: [buildCountdownEmbed(data)] });
    return;
  }

  if (sub === "pin") {
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);

    const cd = countdowns.get(guildId);
    if (!cd) {
      return interaction.reply({
        content: "💧 No countdown set yet. Use `/countdown set` first!",
        ephemeral: true,
      });
    }

    const channel = interaction.options.getChannel("channel");
    await interaction.deferReply({ ephemeral: true });

    const msg = await channel.send({ embeds: [buildCountdownEmbed(cd)] });
    pinnedCountdowns.set(guildId, { channelId: channel.id, messageId: msg.id });

    await startPinInterval(interaction.client, guildId);

    await interaction.editReply({
      content: `🌸 Live countdown pinned in ${channel}! It will auto-update every 5 minutes.`,
    });
    return;
  }

  if (sub === "unpin") {
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);

    if (pinIntervals.has(guildId)) {
      clearInterval(pinIntervals.get(guildId));
      pinIntervals.delete(guildId);
    }
    pinnedCountdowns.delete(guildId);
    await interaction.reply({ content: "🌸 Live countdown stopped.", ephemeral: true });
    return;
  }

  if (sub === "remove") {
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);
    if (!countdowns.has(guildId)) {
      return interaction.reply({ content: "💧 No countdown is set.", ephemeral: true });
    }
    countdowns.delete(guildId);
    await interaction.reply({ content: "✨ Festival countdown gracefully removed.", ephemeral: true });
  }
}
