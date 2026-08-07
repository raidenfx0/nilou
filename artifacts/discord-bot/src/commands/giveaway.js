import {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from "discord.js";
import { NILOU_RED, FOOTER_MAIN, DIVIDER } from "../theme.js";
import { isAdmin, denyAdmin } from "../utils/adminCheck.js";
import { giveaways } from "../data/store.js";
import {
  upsertGiveaway,
  getUserActivity,
  getUserActivityCounts,
  getEconomy,
} from "../db/index.js";

const DAY = 86400000;
const MAX_PARTICIPANTS_PER_PAGE = 10;

function parseDuration(str) {
  const match = String(str || "").match(/^(\d+)(s|m|h|d|w)$/i);
  if (!match) return null;
  const value = Number(match[1]);
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: DAY, w: DAY * 7 };
  const duration = value * multipliers[match[2].toLowerCase()];
  return duration > 0 && duration <= DAY * 365 ? duration : null;
}

function entrantSet(gw) {
  return gw.entrants instanceof Set ? gw.entrants : new Set(gw.entrants || []);
}

function getBonusEntries(gw, member) {
  let bonus = 0;
  for (const [roleId, amount] of Object.entries(gw.roleBonus || {})) {
    if (member?.roles?.cache?.has(roleId)) bonus += Number(amount) || 0;
  }
  return bonus;
}

function getEntryWeight(gw, member) {
  return 1 + getBonusEntries(gw, member);
}

function totalTickets(gw) {
  return [...entrantSet(gw)].reduce((total, id) => total + Number(gw.entryWeights?.[id] || 1), 0);
}

function roleLabel(guild, roleId) {
  return roleId ? `<@&${roleId}>` : null;
}

function requirementLines(gw, guild) {
  const lines = [];
  if (gw.requiredRoleId) lines.push(`Must have the role: ${roleLabel(guild, gw.requiredRoleId)}`);
  if (gw.excludedRoleId) lines.push(`Must not have the role: ${roleLabel(guild, gw.excludedRoleId)}`);
  if (gw.minLevel > 0) lines.push(`Must be level **${gw.minLevel}** or above`);
  if (gw.dailyMessages > 0) lines.push(`Must have sent **${gw.dailyMessages}** message${gw.dailyMessages === 1 ? "" : "s"} today`);
  if (gw.monthlyMessages > 0) lines.push(`Must have sent **${gw.monthlyMessages}** message${gw.monthlyMessages === 1 ? "" : "s"} this month`);
  if (gw.minDays > 0) lines.push(`Must have been active within the last **${gw.minDays} day${gw.minDays === 1 ? "" : "s"}**`);
  return lines;
}

function buildGiveawayEmbed(gw, guild = null) {
  const endTs = Math.floor(gw.endTime / 1000);
  const ended = Boolean(gw.ended || Date.now() >= gw.endTime);
  const participants = entrantSet(gw).size;
  const bonusLines = Object.entries(gw.roleBonus || {}).map(
    ([roleId, amount]) => `${roleLabel(guild, roleId) || `<@&${roleId}>`}: **+${amount} entries**`,
  );
  const requirements = requirementLines(gw, guild);
  const parts = [
    `Click 🎉 button to enter!`,
    `Winners: **${gw.winnerCount}**`,
    `Hosted by: <@${gw.hostId}>`,
    ended ? "Status: **Ended**" : `Ends: <t:${endTs}:R> (<t:${endTs}:F>)`,
    "",
    `Participants: **${participants}** · Tickets: **${totalTickets(gw)}**`,
  ];
  if (bonusLines.length) parts.push("", "**Extra Entries:**", bonusLines.join("\n"));
  if (requirements.length) parts.push("", "**Requirements:**", requirements.join("\n"));
  if (gw.bypassRoleId && requirements.length) {
    parts.push(`Requirements Bypass Role: ${roleLabel(guild, gw.bypassRoleId)}`);
  }

  return new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle(`🎊 ✦ ${gw.prize}`)
    .setDescription(`${DIVIDER}\n${parts.join("\n")}\n${DIVIDER}`)
    .setFooter({ text: ended ? "🌸 Giveaway Ended" : "🌸 Enter for a chance to win!" })
    .setTimestamp();
}

function buildGiveawayRow(messageId, gw, ended = false) {
  const count = entrantSet(gw).size;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`gw_enter:${messageId}`)
      .setLabel(`🎉 ${count}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(ended),
    new ButtonBuilder()
      .setCustomId(`gw_participants:${messageId}:0`)
      .setLabel("Participants")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`gw_leave:${messageId}`)
      .setLabel("Leave")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(ended),
  );
}

function buildParticipantEmbed(gw, guild, page = 0) {
  const ids = [...entrantSet(gw)];
  const totalPages = Math.max(1, Math.ceil(ids.length / MAX_PARTICIPANTS_PER_PAGE));
  const safePage = Math.max(0, Math.min(Number(page) || 0, totalPages - 1));
  const slice = ids.slice(safePage * MAX_PARTICIPANTS_PER_PAGE, (safePage + 1) * MAX_PARTICIPANTS_PER_PAGE);
  const lines = slice.length
    ? slice.map((id, index) => {
      const member = guild?.members?.cache?.get(id);
      const weight = Number(gw.entryWeights?.[id] || getEntryWeight(gw, member));
      return `**${safePage * MAX_PARTICIPANTS_PER_PAGE + index + 1}.** <@${id}> · **${weight} ${weight === 1 ? "entry" : "entries"}**`;
    }).join("\n")
    : "No one has entered yet.";

  return {
    embed: new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle(`🎊 Giveaway Participants — Page ${safePage + 1}/${totalPages}`)
      .setDescription(`${lines}\n\n**Total participants:** ${ids.length}\n**Total tickets:** ${totalTickets(gw)}`)
      .setFooter(FOOTER_MAIN),
    page: safePage,
    totalPages,
  };
}

function buildParticipantRow(messageId, page, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`gw_participants:${messageId}:${page - 1}`).setLabel("Previous").setStyle(ButtonStyle.Secondary).setDisabled(page <= 0),
    new ButtonBuilder().setCustomId(`gw_participants:${messageId}:${page + 1}`).setLabel("Next").setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages - 1),
  );
}

export const data = new SlashCommandBuilder()
  .setName("giveaway")
  .setDescription("Giveaway management")
  .addSubcommand(sub => sub.setName("start").setDescription("Start a giveaway (admin only)")
    .addStringOption(o => o.setName("prize").setDescription("What are you giving away?").setRequired(true))
    .addStringOption(o => o.setName("duration").setDescription("Examples: 1h, 30m, 2d, 1w").setRequired(true))
    .addIntegerOption(o => o.setName("winners").setDescription("Number of winners").setMinValue(1).setMaxValue(20))
    .addChannelOption(o => o.setName("channel").setDescription("Channel to post in"))
    .addRoleOption(o => o.setName("bonus_role").setDescription("Role that gets bonus entries"))
    .addIntegerOption(o => o.setName("bonus_entries").setDescription("Extra entries for the bonus role").setMinValue(1).setMaxValue(20))
    .addRoleOption(o => o.setName("required_role").setDescription("Role required to enter"))
    .addRoleOption(o => o.setName("excluded_role").setDescription("Role that cannot enter"))
    .addRoleOption(o => o.setName("bypass_role").setDescription("Role that bypasses positive requirements"))
    .addIntegerOption(o => o.setName("min_level").setDescription("Minimum Nilou level").setMinValue(0).setMaxValue(100))
    .addIntegerOption(o => o.setName("daily_messages").setDescription("Messages required today").setMinValue(0).setMaxValue(10000))
    .addIntegerOption(o => o.setName("monthly_messages").setDescription("Messages required this month").setMinValue(0).setMaxValue(100000))
    .addIntegerOption(o => o.setName("min_days").setDescription("Must have been active within this many days").setMinValue(0).setMaxValue(30)))
  .addSubcommand(sub => sub.setName("end").setDescription("End a giveaway early (admin only)")
    .addStringOption(o => o.setName("message_id").setDescription("Giveaway message ID").setRequired(true)))
  .addSubcommand(sub => sub.setName("reroll").setDescription("Reroll winners (admin only)")
    .addStringOption(o => o.setName("message_id").setDescription("Giveaway message ID").setRequired(true)))
  .addSubcommand(sub => sub.setName("list").setDescription("List active giveaways"));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === "start") {
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);
    const duration = parseDuration(interaction.options.getString("duration"));
    if (!duration) return interaction.reply({ content: "❌ Invalid duration. Use `1h`, `30m`, `2d`, or `1w` (maximum 365 days).", ephemeral: true });

    const channel = interaction.options.getChannel("channel") || interaction.channel;
    const bonusRole = interaction.options.getRole("bonus_role");
    const endTime = Date.now() + duration;
    const gw = {
      prize: interaction.options.getString("prize"),
      winnerCount: interaction.options.getInteger("winners") || 1,
      endTime, hostId: interaction.user.id, guildId: interaction.guildId, channelId: channel.id,
      ended: false, entrants: new Set(), winners: [], entryWeights: {},
      roleBonus: bonusRole ? { [bonusRole.id]: interaction.options.getInteger("bonus_entries") || 1 } : {},
      requiredRoleId: interaction.options.getRole("required_role")?.id || null,
      excludedRoleId: interaction.options.getRole("excluded_role")?.id || null,
      bypassRoleId: interaction.options.getRole("bypass_role")?.id || null,
      minLevel: interaction.options.getInteger("min_level") || 0,
      dailyMessages: interaction.options.getInteger("daily_messages") || 0,
      monthlyMessages: interaction.options.getInteger("monthly_messages") || 0,
      minDays: interaction.options.getInteger("min_days") || 0,
    };

    await interaction.deferReply({ ephemeral: true });
    const message = await channel.send({ embeds: [buildGiveawayEmbed(gw, interaction.guild)], components: [buildGiveawayRow("TEMP", gw)] });
    gw.messageId = message.id;
    await message.edit({ components: [buildGiveawayRow(message.id, gw)] });
    giveaways.set(message.id, gw);
    await upsertGiveaway(gw);
    gw.timer = setTimeout(() => endGiveaway(interaction.client, message.id), duration);
    await interaction.editReply({ content: `🌸 Giveaway started in ${channel}! Use the 🎉 button to enter.` });
    return;
  }

  if (sub === "end") {
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);
    const id = interaction.options.getString("message_id");
    const gw = giveaways.get(id);
    if (!gw) return interaction.reply({ content: "❌ No giveaway found with that message ID.", ephemeral: true });
    if (gw.timer) clearTimeout(gw.timer);
    await endGiveaway(interaction.client, id);
    return interaction.reply({ content: "🌸 Giveaway ended.", ephemeral: true });
  }

  if (sub === "reroll") {
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);
    const id = interaction.options.getString("message_id");
    const gw = giveaways.get(id);
    if (!gw || !gw.ended) return interaction.reply({ content: "❌ No ended giveaway found.", ephemeral: true });
    await rerollGiveaway(interaction.client, id, interaction.channel);
    return interaction.reply({ content: "🌸 Giveaway rerolled.", ephemeral: true });
  }

  const active = [...giveaways.values()].filter(g => g.guildId === interaction.guildId && !g.ended);
  if (!active.length) return interaction.reply({ content: "💧 No active giveaways right now.", ephemeral: true });
  const embed = new EmbedBuilder()
    .setColor(NILOU_RED).setTitle("✦ Active Giveaways")
    .setDescription(active.map(g => `🎊 **${g.prize}** — <#${g.channelId}> — ${entrantSet(g).size} participants / ${totalTickets(g)} tickets — Ends <t:${Math.floor(g.endTime / 1000)}:R>`).join("\n"))
    .setFooter(FOOTER_MAIN).setTimestamp();
  return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function checkEligibility(interaction, gw) {
  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (member.user.bot) return { ok: false, reason: "Bots cannot enter giveaways." };
  if (gw.excludedRoleId && member.roles.cache.has(gw.excludedRoleId)) return { ok: false, reason: `You cannot enter while you have <@&${gw.excludedRoleId}>.` };

  const bypasses = gw.bypassRoleId && member.roles.cache.has(gw.bypassRoleId);
  if (!bypasses && gw.requiredRoleId && !member.roles.cache.has(gw.requiredRoleId)) {
    return { ok: false, reason: `You need <@&${gw.requiredRoleId}> to enter.` };
  }
  if (!bypasses && gw.minLevel > 0) {
    const economy = await getEconomy(interaction.user.id);
    if (Number(economy.level || 1) < gw.minLevel) return { ok: false, reason: `You need to be level ${gw.minLevel} or higher.` };
  }
  if (!bypasses && (gw.dailyMessages > 0 || gw.monthlyMessages > 0)) {
    const counts = await getUserActivityCounts(gw.guildId, interaction.user.id);
    if (gw.dailyMessages > 0 && Number(counts?.daily_message_count || 0) < gw.dailyMessages) {
      return { ok: false, reason: `You need ${gw.dailyMessages} messages today; you have ${Number(counts?.daily_message_count || 0)}.` };
    }
    if (gw.monthlyMessages > 0 && Number(counts?.monthly_message_count || 0) < gw.monthlyMessages) {
      return { ok: false, reason: `You need ${gw.monthlyMessages} messages this month; you have ${Number(counts?.monthly_message_count || 0)}.` };
    }
  }
  if (!bypasses && gw.minDays > 0) {
    const activity = await getUserActivity(gw.guildId, interaction.user.id, Date.now() - gw.minDays * DAY);
    if (!activity) return { ok: false, reason: `You need activity within the last ${gw.minDays} day${gw.minDays === 1 ? "" : "s"}.` };
  }
  return { ok: true, member };
}

export async function handleGiveawayButton(interaction) {
  const [action, messageId, page] = interaction.customId.split(":");
  const gw = giveaways.get(messageId);
  if (!gw) return interaction.reply({ content: "❌ This giveaway could not be found.", ephemeral: true });

  if (action === "gw_participants") {
    const view = buildParticipantEmbed(gw, interaction.guild, Number(page) || 0);
    return interaction.reply({ embeds: [view.embed], components: [buildParticipantRow(messageId, view.page, view.totalPages)], ephemeral: true });
  }
  if (gw.ended) return interaction.reply({ content: "❌ This giveaway is no longer active.", ephemeral: true });

  const entrants = entrantSet(gw);
  if (action === "gw_enter") {
    if (entrants.has(interaction.user.id)) return interaction.reply({ content: "You are already entered. Use Leave to withdraw.", ephemeral: true });
    const eligibility = await checkEligibility(interaction, gw);
    if (!eligibility.ok) return interaction.reply({ content: `❌ ${eligibility.reason}`, ephemeral: true });
    entrants.add(interaction.user.id);
    gw.entrants = entrants;
    gw.entryWeights[interaction.user.id] = getEntryWeight(gw, eligibility.member);
    giveaways.set(messageId, gw);
    await upsertGiveaway(gw);
    await interaction.message.edit({ embeds: [buildGiveawayEmbed(gw, interaction.guild)], components: [buildGiveawayRow(messageId, gw)] });
    return interaction.reply({ content: `🎉 You are entered in **${gw.prize}** with **${gw.entryWeights[interaction.user.id]} ${gw.entryWeights[interaction.user.id] === 1 ? "ticket" : "tickets"}**. Good luck!`, ephemeral: true });
  }
  if (action === "gw_leave") {
    if (!entrants.has(interaction.user.id)) return interaction.reply({ content: "You are not entered in this giveaway.", ephemeral: true });
    entrants.delete(interaction.user.id);
    delete gw.entryWeights[interaction.user.id];
    gw.entrants = entrants;
    await upsertGiveaway(gw);
    await interaction.message.edit({ embeds: [buildGiveawayEmbed(gw, interaction.guild)], components: [buildGiveawayRow(messageId, gw)] });
    return interaction.reply({ content: "You have left the giveaway.", ephemeral: true });
  }
}

function weightedWinners(gw, ids, count) {
  const pool = ids.map(id => ({ id, weight: Math.max(1, Number(gw.entryWeights?.[id] || 1)) }));
  const winners = [];
  while (pool.length && winners.length < count) {
    const total = pool.reduce((sum, item) => sum + item.weight, 0);
    let cursor = Math.random() * total;
    let picked = 0;
    for (let i = 0; i < pool.length; i++) {
      cursor -= pool[i].weight;
      if (cursor <= 0) { picked = i; break; }
    }
    winners.push(pool[picked].id);
    pool.splice(picked, 1);
  }
  return winners;
}

async function getActiveEntrants(client, gw) {
  const guild = await client.guilds.fetch(gw.guildId);
  const ids = [...entrantSet(gw)].filter(id => id !== client.user.id);
  const fetched = await Promise.all(ids.map(id => guild.members.fetch(id).catch(() => null)));
  const members = new Map(fetched.filter(Boolean).map(member => [member.id, member]));
  const valid = ids.filter(id => {
    const member = members?.get(id);
    return member && !(gw.excludedRoleId && member.roles.cache.has(gw.excludedRoleId));
  });
  return { guild, valid };
}

export async function endGiveaway(client, messageId) {
  const gw = giveaways.get(messageId);
  if (!gw || gw.ended) return;
  if (gw.timer) clearTimeout(gw.timer);
  try {
    const { guild, valid } = await getActiveEntrants(client, gw);
    const channel = await guild.channels.fetch(gw.channelId);
    const message = await channel.messages.fetch(messageId);
    const winners = weightedWinners(gw, valid, Math.min(gw.winnerCount, valid.length));
    gw.ended = true;
    gw.winners = winners;
    gw.entrants = entrantSet(gw);
    const winnerText = winners.length ? winners.map(id => `<@${id}>`).join(", ") : "No valid entries";
    const embed = buildGiveawayEmbed(gw, guild).setDescription(`${DIVIDER}\n${winners.length ? `Winner${winners.length > 1 ? "s" : ""}: ${winnerText}\n\nPrize: **${gw.prize}**` : "❌ No valid entries. No winners this time."}\n\nTotal tickets: **${totalTickets(gw)}**\n${DIVIDER}`);
    await message.edit({ embeds: [embed], components: [buildGiveawayRow(messageId, gw, true)] });
    await channel.send(winners.length ? `🎊 Congratulations ${winnerText}! You won **${gw.prize}**! Contact <@${gw.hostId}> to claim.` : "💧 The giveaway ended but nobody met the entry requirements.");
    giveaways.set(messageId, gw);
    await upsertGiveaway(gw);
  } catch (err) {
    console.error("Giveaway end error:", err.message);
  }
}

export async function restoreGiveawayTimers(client) {
  for (const [messageId, gw] of giveaways) {
    if (gw.ended) continue;
    const remaining = gw.endTime - Date.now();
    if (remaining <= 0) void endGiveaway(client, messageId);
    else {
      gw.timer = setTimeout(() => endGiveaway(client, messageId), remaining);
      giveaways.set(messageId, gw);
    }
  }
}

async function rerollGiveaway(client, messageId, fallbackChannel) {
  const gw = giveaways.get(messageId);
  if (!gw) return;
  try {
    const { valid } = await getActiveEntrants(client, gw);
    const winners = weightedWinners(gw, valid.filter(id => !gw.winners?.includes(id)), Math.min(gw.winnerCount, valid.length));
    const target = fallbackChannel || await (await client.guilds.fetch(gw.guildId)).channels.fetch(gw.channelId);
    if (!winners.length) return target.send("💧 No valid entries are available for a reroll.");
    const text = winners.map(id => `<@${id}>`).join(", ");
    await target.send(`🎊 Reroll winner${winners.length > 1 ? "s" : ""}: ${text}! You won **${gw.prize}**.`);
    gw.winners = [...(gw.winners || []), ...winners];
    await upsertGiveaway(gw);
  } catch (err) {
    console.error("Giveaway reroll error:", err.message);
  }
}