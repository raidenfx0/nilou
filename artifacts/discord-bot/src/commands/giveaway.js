import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { NILOU_RED, FOOTER_MAIN, DIVIDER } from "../theme.js";
import { isAdmin, denyAdmin } from "../utils/adminCheck.js";
import { giveaways } from "../data/store.js";

function parseDuration(str) {
  const match = str.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;
  const val = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return val * multipliers[unit];
}

function buildGiveawayEmbed(gw) {
  const endTs = Math.floor(gw.endTime / 1000);
  const ended = Date.now() >= gw.endTime;

  return new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle(`🎊 ✦ GIVEAWAY — ${gw.prize}`)
    .setDescription(
      `${DIVIDER}\n` +
      `React with 🎉 to enter!\n\n` +
      `Winners: **${gw.winnerCount}**\n` +
      `Hosted by: <@${gw.hostId}>\n` +
      (ended ? `Status: Ended` : `Ends: <t:${endTs}:R> (<t:${endTs}:F>)`) +
      `\n${DIVIDER}`
    )
    .setFooter({ text: ended ? "🌸 Giveaway Ended" : "🌸 React with 🎉 to enter!" })
    .setTimestamp();
}

export const data = new SlashCommandBuilder()
  .setName("giveaway")
  .setDescription("Giveaway management")
  .addSubcommand((sub) =>
    sub
      .setName("start")
      .setDescription("Start a giveaway (admin only)")
      .addStringOption((o) =>
        o.setName("prize").setDescription("What are you giving away?").setRequired(true)
      )
      .addStringOption((o) =>
        o.setName("duration").setDescription("Duration (e.g. 1h, 30m, 2d)").setRequired(true)
      )
      .addIntegerOption((o) =>
        o.setName("winners").setDescription("Number of winners").setRequired(false).setMinValue(1).setMaxValue(20)
      )
      .addChannelOption((o) =>
        o.setName("channel").setDescription("Channel to post giveaway in").setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("end")
      .setDescription("End a giveaway early (admin only)")
      .addStringOption((o) =>
        o.setName("message_id").setDescription("Message ID of the giveaway").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("reroll")
      .setDescription("Reroll winners for a giveaway (admin only)")
      .addStringOption((o) =>
        o.setName("message_id").setDescription("Message ID of the giveaway").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("list").setDescription("List active giveaways")
  );

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === "start") {
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);

    const prize       = interaction.options.getString("prize");
    const durationStr = interaction.options.getString("duration");
    const winnerCount = interaction.options.getInteger("winners") || 1;
    const channel     = interaction.options.getChannel("channel") || interaction.channel;

    const duration = parseDuration(durationStr);
    if (!duration) {
      return interaction.reply({
        content: "❌ Invalid duration format. Use examples like `1h`, `30m`, `2d`, `10s`.",
        ephemeral: true,
      });
    }

    const endTime = Date.now() + duration;
    await interaction.deferReply({ ephemeral: true });

    const gwData = {
      prize,
      winnerCount,
      endTime,
      hostId: interaction.user.id,
      guildId: interaction.guildId,
      channelId: channel.id,
      ended: false,
    };

    const embed = buildGiveawayEmbed(gwData);
    const msg = await channel.send({ embeds: [embed] });
    await msg.react("🎉");

    gwData.messageId = msg.id;
    giveaways.set(msg.id, gwData);

    const timer = setTimeout(async () => {
      await endGiveaway(interaction.client, msg.id);
    }, duration);
    gwData.timer = timer;
    giveaways.set(msg.id, gwData);

    await interaction.editReply({
      content: `🌸 Giveaway started in ${channel}! Good luck to all~ 🎊`,
    });
    return;
  }

  if (sub === "end") {
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);
    const msgId = interaction.options.getString("message_id");
    const gw = giveaways.get(msgId);
    if (!gw) {
      return interaction.reply({ content: "❌ No giveaway found with that message ID.", ephemeral: true });
    }
    if (gw.timer) clearTimeout(gw.timer);
    await endGiveaway(interaction.client, msgId);
    await interaction.reply({ content: "🌸 Giveaway ended!", ephemeral: true });
    return;
  }

  if (sub === "reroll") {
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);
    const msgId = interaction.options.getString("message_id");
    const gw = giveaways.get(msgId);
    if (!gw || !gw.ended) {
      return interaction.reply({ content: "❌ No ended giveaway found with that message ID.", ephemeral: true });
    }
    await rerollGiveaway(interaction.client, msgId, interaction.channel);
    await interaction.reply({ content: "🌸 Giveaway rerolled!", ephemeral: true });
    return;
  }

  if (sub === "list") {
    const active = [...giveaways.values()].filter(
      (g) => g.guildId === interaction.guildId && !g.ended
    );

    if (active.length === 0) {
      return interaction.reply({ content: "💧 No active giveaways right now.", ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle("✦ Active Giveaways")
      .setDescription(
        active
          .map((g) => `🎊 **${g.prize}** — <#${g.channelId}> — Ends <t:${Math.floor(g.endTime / 1000)}:R>`)
          .join("\n")
      )
      .setFooter(FOOTER_MAIN)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
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

    const reaction = msg.reactions.cache.get("🎉");
    const users    = reaction ? await reaction.users.fetch() : new Map();
    const eligible = [...users.values()].filter((u) => !u.bot);

    const embed = buildGiveawayEmbed(gw);

    if (eligible.length === 0) {
      embed.setDescription(`${DIVIDER}\n❌ No valid entries. No winners this time.\n${DIVIDER}`);
      await msg.edit({ embeds: [embed] });
      await channel.send("💧 The giveaway ended but nobody entered. Better luck next time~");
      return;
    }

    const shuffled = eligible.sort(() => Math.random() - 0.5);
    const winners  = shuffled.slice(0, Math.min(gw.winnerCount, eligible.length));
    const winMentions = winners.map((u) => `<@${u.id}>`).join(", ");

    embed.setDescription(
      `${DIVIDER}\n` +
      `Winner${winners.length > 1 ? "s" : ""}: ${winMentions}\n\n` +
      `Prize: **${gw.prize}**\n` +
      `Total entries: ${eligible.length}\n` +
      `${DIVIDER}`
    );

    await msg.edit({ embeds: [embed] });
    await channel.send(
      `🎊 Congratulations ${winMentions}! You won **${gw.prize}**! Contact <@${gw.hostId}> to claim your prize~ 🌸`
    );

    gw.winners = winners.map((u) => u.id);
    giveaways.set(messageId, gw);
  } catch (err) {
    console.error("Giveaway end error:", err.message);
  }
}

async function rerollGiveaway(client, messageId, fallbackChannel) {
  const gw = giveaways.get(messageId);
  if (!gw) return;

  try {
    const guild   = await client.guilds.fetch(gw.guildId);
    const channel = await guild.channels.fetch(gw.channelId);
    const msg     = await channel.messages.fetch(messageId);
    const reaction = msg.reactions.cache.get("🎉");
    const users    = reaction ? await reaction.users.fetch() : new Map();
    const eligible = [...users.values()].filter((u) => !u.bot);

    if (eligible.length === 0) {
      await (fallbackChannel || channel).send("💧 No valid entries to reroll.");
      return;
    }

    const shuffled = eligible.sort(() => Math.random() - 0.5);
    const winners  = shuffled.slice(0, Math.min(gw.winnerCount, eligible.length));
    const winMentions = winners.map((u) => `<@${u.id}>`).join(", ");

    await (fallbackChannel || channel).send(
      `🎊 Reroll! New winner${winners.length > 1 ? "s" : ""}: ${winMentions}! Congratulations~ 🌸`
    );
  } catch (err) {
    console.error("Giveaway reroll error:", err.message);
  }
}
