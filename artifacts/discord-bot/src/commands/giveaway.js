import {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from "discord.js";
import { NILOU_RED, FOOTER_MAIN, DIVIDER } from "../theme.js";
import { isAdmin, denyAdmin } from "../utils/adminCheck.js";
import { giveaways } from "../data/store.js";
import { upsertGiveaway } from "../db/index.js";

function parseDuration(str) {
  const match = str.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;
  const val = parseInt(match[1]);
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return val * multipliers[match[2].toLowerCase()];
}

function buildGiveawayEmbed(gw) {
  const endTs   = Math.floor(gw.endTime / 1000);
  const ended   = Date.now() >= gw.endTime;
  const count   = gw.entrants instanceof Set ? gw.entrants.size : (gw.entrants?.length ?? 0);

  return new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle(`🎊 ✦ GIVEAWAY — ${gw.prize}`)
    .setDescription(
      `${DIVIDER}\n` +
      `Click **Enter Giveaway** below to enter!\n\n` +
      `Winners: **${gw.winnerCount}**\n` +
      `Entries: **${count}**\n` +
      `Hosted by: <@${gw.hostId}>\n` +
      (ended ? `Status: **Ended**` : `Ends: <t:${endTs}:R> (<t:${endTs}:F>)`) +
      `\n${DIVIDER}`
    )
    .setFooter({ text: ended ? "🌸 Giveaway Ended" : "🌸 Click the button to enter!" })
    .setTimestamp();
}

function buildGiveawayRow(messageId, ended = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`gw_enter:${messageId}`)
      .setLabel("Enter Giveaway 🎉")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(ended),
    new ButtonBuilder()
      .setCustomId(`gw_leave:${messageId}`)
      .setLabel("Leave")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(ended),
  );
}

export const data = new SlashCommandBuilder()
  .setName("giveaway")
  .setDescription("Giveaway management")
  .addSubcommand(sub =>
    sub.setName("start").setDescription("Start a giveaway (admin only)")
      .addStringOption(o => o.setName("prize").setDescription("What are you giving away?").setRequired(true))
      .addStringOption(o => o.setName("duration").setDescription("Duration e.g. 1h, 30m, 2d").setRequired(true))
      .addIntegerOption(o => o.setName("winners").setDescription("Number of winners").setMinValue(1).setMaxValue(20))
      .addChannelOption(o => o.setName("channel").setDescription("Channel to post in"))
  )
  .addSubcommand(sub =>
    sub.setName("end").setDescription("End a giveaway early (admin only)")
      .addStringOption(o => o.setName("message_id").setDescription("Message ID of the giveaway").setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName("reroll").setDescription("Reroll winners (admin only)")
      .addStringOption(o => o.setName("message_id").setDescription("Message ID of the giveaway").setRequired(true))
  )
  .addSubcommand(sub => sub.setName("list").setDescription("List active giveaways"));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === "start") {
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);

    const prize       = interaction.options.getString("prize");
    const durationStr = interaction.options.getString("duration");
    const winnerCount = interaction.options.getInteger("winners") || 1;
    const channel     = interaction.options.getChannel("channel") || interaction.channel;

    const duration = parseDuration(durationStr);
    if (!duration) return interaction.reply({ content: "❌ Invalid duration. Use `1h`, `30m`, `2d`, `10s`.", ephemeral: true });

    await interaction.deferReply({ ephemeral: true });

    const endTime = Date.now() + duration;
    const gwData  = {
      prize, winnerCount, endTime,
      hostId: interaction.user.id,
      guildId: interaction.guildId,
      channelId: channel.id,
      ended: false,
      entrants: new Set(),
      winners: [],
    };

    const embed = buildGiveawayEmbed(gwData);
    const msg   = await channel.send({ embeds: [embed], components: [buildGiveawayRow("TEMP")] });

    gwData.messageId = msg.id;
    await msg.edit({ components: [buildGiveawayRow(msg.id)] });

    giveaways.set(msg.id, gwData);
    await upsertGiveaway({ ...gwData, entrants: [...gwData.entrants] });

    gwData.timer = setTimeout(() => endGiveaway(interaction.client, msg.id), duration);
    giveaways.set(msg.id, gwData);

    await interaction.editReply({ content: `🌸 Giveaway started in ${channel}! 🎊` });
    return;
  }

  if (sub === "end") {
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);
    const msgId = interaction.options.getString("message_id");
    const gw    = giveaways.get(msgId);
    if (!gw) return interaction.reply({ content: "❌ No giveaway found with that message ID.", ephemeral: true });
    if (gw.timer) clearTimeout(gw.timer);
    await endGiveaway(interaction.client, msgId);
    await interaction.reply({ content: "🌸 Giveaway ended!", ephemeral: true });
    return;
  }

  if (sub === "reroll") {
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);
    const msgId = interaction.options.getString("message_id");
    const gw    = giveaways.get(msgId);
    if (!gw || !gw.ended) return interaction.reply({ content: "❌ No ended giveaway found.", ephemeral: true });
    await rerollGiveaway(interaction.client, msgId, interaction.channel);
    await interaction.reply({ content: "🌸 Giveaway rerolled!", ephemeral: true });
    return;
  }

  if (sub === "list") {
    const active = [...giveaways.values()].filter(g => g.guildId === interaction.guildId && !g.ended);
    if (active.length === 0) return interaction.reply({ content: "💧 No active giveaways right now.", ephemeral: true });
    const embed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle("✦ Active Giveaways")
      .setDescription(active.map(g =>
        `🎊 **${g.prize}** — <#${g.channelId}> — ${g.entrants instanceof Set ? g.entrants.size : 0} entries — Ends <t:${Math.floor(g.endTime / 1000)}:R>`
      ).join("\n"))
      .setFooter(FOOTER_MAIN)
      .setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

export async function handleGiveawayButton(interaction) {
  const [action, messageId] = interaction.customId.split(":");
  const gw = giveaways.get(messageId);
  if (!gw || gw.ended) {
    return interaction.reply({ content: "❌ This giveaway is no longer active.", ephemeral: true });
  }

  const userId = interaction.user.id;
  if (!gw.entrants) gw.entrants = new Set();

  if (action === "gw_enter") {
    if (gw.entrants.has(userId)) {
      return interaction.reply({ content: "You are already entered in this giveaway! Use Leave to withdraw.", ephemeral: true });
    }
    gw.entrants.add(userId);
    giveaways.set(messageId, gw);
    await upsertGiveaway({ ...gw, entrants: [...gw.entrants] });

    await interaction.message.edit({
      embeds: [buildGiveawayEmbed(gw)],
      components: [buildGiveawayRow(messageId)],
    });
    return interaction.reply({ content: `🎉 You're entered in the **${gw.prize}** giveaway! Good luck~`, ephemeral: true });
  }

  if (action === "gw_leave") {
    if (!gw.entrants.has(userId)) {
      return interaction.reply({ content: "You are not entered in this giveaway.", ephemeral: true });
    }
    gw.entrants.delete(userId);
    giveaways.set(messageId, gw);
    await upsertGiveaway({ ...gw, entrants: [...gw.entrants] });

    await interaction.message.edit({
      embeds: [buildGiveawayEmbed(gw)],
      components: [buildGiveawayRow(messageId)],
    });
    return interaction.reply({ content: "You have left the giveaway.", ephemeral: true });
  }
}

export async function endGiveaway(client, messageId) {
  const gw = giveaways.get(messageId);
  if (!gw || gw.ended) return;

  gw.ended = true;
  giveaways.set(messageId, gw);

  try {
    const guild   = await client.guilds.fetch(gw.guildId);
    const channel = await guild.channels.fetch(gw.channelId);
    const msg     = await channel.messages.fetch(messageId);

    const eligible = [...(gw.entrants instanceof Set ? gw.entrants : new Set(gw.entrants))]
      .filter(id => id !== client.user.id);

    const embed = buildGiveawayEmbed(gw);

    if (eligible.length === 0) {
      embed.setDescription(`${DIVIDER}\n❌ No valid entries. No winners this time.\n${DIVIDER}`);
      await msg.edit({ embeds: [embed], components: [buildGiveawayRow(messageId, true)] });
      await channel.send("💧 The giveaway ended but nobody entered.");
      await upsertGiveaway({ ...gw, entrants: [...gw.entrants] });
      return;
    }

    const shuffled    = eligible.sort(() => Math.random() - 0.5);
    const winners     = shuffled.slice(0, Math.min(gw.winnerCount, eligible.length));
    const winMentions = winners.map(id => `<@${id}>`).join(", ");

    embed.setDescription(
      `${DIVIDER}\n` +
      `Winner${winners.length > 1 ? "s" : ""}: ${winMentions}\n\n` +
      `Prize: **${gw.prize}**\n` +
      `Total entries: ${eligible.length}\n` +
      `${DIVIDER}`
    );

    await msg.edit({ embeds: [embed], components: [buildGiveawayRow(messageId, true)] });
    await channel.send(`🎊 Congratulations ${winMentions}! You won **${gw.prize}**! Contact <@${gw.hostId}> to claim. 🌸`);

    gw.winners = winners;
    giveaways.set(messageId, gw);
    await upsertGiveaway({ ...gw, entrants: [...gw.entrants] });
  } catch (err) {
    console.error("Giveaway end error:", err.message);
  }
}

export async function restoreGiveawayTimers(client) {
  for (const [messageId, gw] of giveaways) {
    if (gw.ended) continue;
    const remaining = gw.endTime - Date.now();
    if (remaining <= 0) {
      endGiveaway(client, messageId);
    } else {
      gw.timer = setTimeout(() => endGiveaway(client, messageId), remaining);
      giveaways.set(messageId, gw);
    }
  }
}

async function rerollGiveaway(client, messageId, fallbackChannel) {
  const gw = giveaways.get(messageId);
  if (!gw) return;

  const eligible = [...(gw.entrants instanceof Set ? gw.entrants : new Set(gw.entrants))]
    .filter(id => id !== client.user.id);

  try {
    const guild   = await client.guilds.fetch(gw.guildId);
    const channel = await guild.channels.fetch(gw.channelId);

    if (eligible.length === 0) {
      await (fallbackChannel || channel).send("💧 No valid entries to reroll.");
      return;
    }
    const winners     = eligible.sort(() => Math.random() - 0.5).slice(0, Math.min(gw.winnerCount, eligible.length));
    const winMentions = winners.map(id => `<@${id}>`).join(", ");
    await (fallbackChannel || channel).send(`🎊 Reroll! New winner${winners.length > 1 ? "s" : ""}: ${winMentions}! 🌸`);
  } catch (err) {
    console.error("Giveaway reroll error:", err.message);
  }
}
