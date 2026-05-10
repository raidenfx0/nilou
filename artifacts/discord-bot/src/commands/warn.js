import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { NILOU_RED, FOOTER_MAIN, DIVIDER } from "../theme.js";
import { isAdmin, denyAdmin } from "../utils/adminCheck.js";
import {
  addWarning, getWarnings, getTotalWarnPoints,
  clearWarnings, removeWarning, getAllWarnings,
} from "../db/index.js";
import { sendLog } from "../utils/logger.js";

const THRESHOLDS = [
  { points: 3,  action: "mute",  duration: 10 * 60 * 1000, label: "10-minute mute" },
  { points: 5,  action: "kick",  label: "kick" },
  { points: 10, action: "ban",   label: "ban" },
];

export const data = new SlashCommandBuilder()
  .setName("warn")
  .setDescription("Warning system")
  .addSubcommand(sub =>
    sub.setName("add")
      .setDescription("Warn a user")
      .addUserOption(o => o.setName("user").setDescription("User to warn").setRequired(true))
      .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true))
      .addIntegerOption(o => o.setName("points").setDescription("Warning points (default 1)").setMinValue(1).setMaxValue(5).setRequired(false))
  )
  .addSubcommand(sub =>
    sub.setName("list")
      .setDescription("View warnings for a user")
      .addUserOption(o => o.setName("user").setDescription("User to check").setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName("remove")
      .setDescription("Remove a specific warning by ID")
      .addIntegerOption(o => o.setName("id").setDescription("Warning ID").setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName("clear")
      .setDescription("Clear all warnings for a user")
      .addUserOption(o => o.setName("user").setDescription("User to clear").setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName("server")
      .setDescription("View all active warnings in this server")
  );

export async function execute(interaction) {
  if (!isAdmin(interaction.member)) return denyAdmin(interaction);

  const sub = interaction.options.getSubcommand();

  if (sub === "add") {
    const target = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason");
    const points = interaction.options.getInteger("points") || 1;

    if (target.bot) return interaction.reply({ content: "❌ Cannot warn a bot.", ephemeral: true });
    if (target.id === interaction.user.id) return interaction.reply({ content: "❌ Cannot warn yourself.", ephemeral: true });

    const warning    = await addWarning(interaction.guildId, target.id, interaction.user.id, reason, points);
    const totalPts   = await getTotalWarnPoints(interaction.guildId, target.id);
    const warnList   = await getWarnings(interaction.guildId, target.id);

    const threshold  = THRESHOLDS.slice().reverse().find(t => totalPts >= t.points);
    let actionTaken  = "";

    const member = interaction.guild.members.cache.get(target.id) ||
                   await interaction.guild.members.fetch(target.id).catch(() => null);

    if (threshold && member) {
      if (threshold.action === "mute") {
        await member.timeout(threshold.duration, `Auto-mute: ${totalPts} warning points`).catch(() => {});
        actionTaken = `\n⚠️ Auto-action: **${threshold.label}** applied (${totalPts} pts)`;
      } else if (threshold.action === "kick") {
        await member.kick(`Auto-kick: ${totalPts} warning points`).catch(() => {});
        actionTaken = `\n⚠️ Auto-action: **${threshold.label}** applied (${totalPts} pts)`;
      } else if (threshold.action === "ban") {
        await member.ban({ reason: `Auto-ban: ${totalPts} warning points` }).catch(() => {});
        actionTaken = `\n⚠️ Auto-action: **${threshold.label}** applied (${totalPts} pts)`;
      }
    }

    const embed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle("✦ Warning Issued")
      .setDescription(
        `${DIVIDER}\n` +
        `🌸 ${target} has been warned!\n\n` +
        `Reason: **${reason}**\n` +
        `Points added: **+${points}**\n` +
        `Total points: **${totalPts}** (${warnList.length} warning${warnList.length !== 1 ? "s" : ""})\n` +
        `Warning ID: \`#${warning.id}\`` +
        actionTaken +
        `\n${DIVIDER}`
      )
      .setFooter(FOOTER_MAIN)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    await sendLog(interaction.guild, "warn", {
      title: "⚠️ User Warned",
      description:
        `User: ${target.tag} (${target.id})\n` +
        `Moderator: ${interaction.user.tag}\n` +
        `Reason: ${reason}\n` +
        `Points: +${points} → Total: ${totalPts}` +
        (actionTaken ? `\nAuto-action: ${threshold?.label}` : ""),
    });

    try {
      await target.send({
        embeds: [
          new EmbedBuilder()
            .setColor(NILOU_RED)
            .setTitle(`✦ You received a warning in ${interaction.guild.name}`)
            .setDescription(`Reason: **${reason}**\nPoints: +${points} → Total: ${totalPts}${actionTaken}`)
            .setFooter(FOOTER_MAIN)
            .setTimestamp(),
        ],
      });
    } catch {}
    return;
  }

  if (sub === "list") {
    const target   = interaction.options.getUser("user");
    const warnings = await getWarnings(interaction.guildId, target.id);
    const total    = await getTotalWarnPoints(interaction.guildId, target.id);

    const embed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle(`✦ Warnings — ${target.username}`)
      .setDescription(`${DIVIDER}\nTotal points: **${total}** | Warnings: **${warnings.length}**\n${DIVIDER}`)
      .setFooter(FOOTER_MAIN)
      .setTimestamp();

    if (warnings.length === 0) {
      embed.addFields({ name: "No warnings", value: "This user has no active warnings 🌸", inline: false });
    } else {
      for (const w of warnings.slice(0, 10)) {
        const date = new Date(w.created_at).toLocaleDateString();
        embed.addFields({
          name: `#${w.id} — ${w.points} pt${w.points !== 1 ? "s" : ""} · ${date}`,
          value: `Reason: ${w.reason}\nMod: <@${w.moderator_id}>`,
          inline: false,
        });
      }
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (sub === "remove") {
    const id = interaction.options.getInteger("id");
    await removeWarning(id);
    await interaction.reply({ content: `🌸 Warning \`#${id}\` has been removed.`, ephemeral: true });
    return;
  }

  if (sub === "clear") {
    const target = interaction.options.getUser("user");
    await clearWarnings(interaction.guildId, target.id);
    await interaction.reply({ content: `🌸 All warnings cleared for ${target}.`, ephemeral: true });
    return;
  }

  if (sub === "server") {
    const warnings = await getAllWarnings(interaction.guildId);
    const embed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle("✦ Server Warnings")
      .setDescription(`${DIVIDER}\n${warnings.length} active warning${warnings.length !== 1 ? "s" : ""}\n${DIVIDER}`)
      .setFooter(FOOTER_MAIN)
      .setTimestamp();

    const grouped = {};
    for (const w of warnings) {
      if (!grouped[w.user_id]) grouped[w.user_id] = { total: 0, count: 0 };
      grouped[w.user_id].total += w.points;
      grouped[w.user_id].count++;
    }

    const sorted = Object.entries(grouped).sort(([,a],[,b]) => b.total - a.total).slice(0, 10);
    for (const [userId, data] of sorted) {
      embed.addFields({
        name: `<@${userId}>`,
        value: `${data.total} pts · ${data.count} warning${data.count !== 1 ? "s" : ""}`,
        inline: true,
      });
    }

    await interaction.reply({ embeds: [embed] });
    return;
  }
}
