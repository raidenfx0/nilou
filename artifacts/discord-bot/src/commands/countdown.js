import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { countdowns } from "../data/store.js";
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
      .setName("remove")
      .setDescription("Remove the festival countdown (admin only)")
  );

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

  } else if (sub === "show") {
    const data = countdowns.get(guildId);
    if (!data) {
      return interaction.reply({
        content: "💧 No festival countdown has been set. Ask an admin to use `/countdown set` first!",
        ephemeral: true,
      });
    }

    const { name, unixTs, description } = data;
    const now      = Math.floor(Date.now() / 1000);
    const diff     = unixTs - now;
    const started  = diff <= 0;

    const totalDays  = Math.floor(Math.abs(diff) / 86400);
    const totalHours = Math.floor((Math.abs(diff) % 86400) / 3600);
    const totalMins  = Math.floor((Math.abs(diff) % 3600) / 60);
    const totalSecs  = Math.abs(diff) % 60;

    const timeBreakdown = started
      ? `The festival started <t:${unixTs}:R>!`
      : `**${totalDays}** days **${totalHours}** hours **${totalMins}** minutes **${totalSecs}** seconds`;

    const embed = new EmbedBuilder()
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
        {
          name: "🕐 Breakdown",
          value: timeBreakdown,
          inline: false,
        },
        {
          name: "📌 Short Date",
          value: `<t:${unixTs}:d>`,
          inline: true,
        },
        {
          name: "🗓️ Long Date",
          value: `<t:${unixTs}:D>`,
          inline: true,
        },
      )
      .setFooter({ text: `🌸 Nilou • ${name}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

  } else if (sub === "remove") {
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);

    if (!countdowns.has(guildId)) {
      return interaction.reply({ content: "💧 No countdown is set.", ephemeral: true });
    }

    countdowns.delete(guildId);
    await interaction.reply({ content: "✨ Festival countdown gracefully removed.", ephemeral: true });
  }
}
