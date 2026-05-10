import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { NILOU_RED, FOOTER_MAIN, DIVIDER } from "../theme.js";
import { isAdmin, denyAdmin } from "../utils/adminCheck.js";
import { countingChannels } from "../data/store.js";
import {
  upsertCountingConfig, getCountingConfig,
  getCountingSaves, upsertCountingSaves,
  getGuildSaves, setGuildSaves,
  getEconomy, updateEconomy,
} from "../db/index.js";

const SAVE_BUY_COST = 50;
const MAX_PERSONAL_SAVES = 5;
const DAILY_MS = 86400000;

export const data = new SlashCommandBuilder()
  .setName("counting")
  .setDescription("Counting channel management")
  .addSubcommand(sub =>
    sub.setName("set").setDescription("Set the counting channel (admin only)")
      .addChannelOption(o => o.setName("channel").setDescription("The counting channel").setRequired(true))
  )
  .addSubcommand(sub => sub.setName("info").setDescription("Show current count and stats"))
  .addSubcommand(sub =>
    sub.setName("save").setDescription("Manage your counting saves")
      .addStringOption(o =>
        o.setName("action").setDescription("What to do with saves").setRequired(true)
          .addChoices(
            { name: "claim — claim your free daily save", value: "claim" },
            { name: "use — use a save to restore the count", value: "use" },
            { name: "buy — buy an extra save (50 🎟️ TC)", value: "buy" },
            { name: "status — check your saves", value: "status" },
          )
      )
  )
  .addSubcommand(sub =>
    sub.setName("donate").setDescription("Donate saves to the guild save pool")
      .addIntegerOption(o => o.setName("amount").setDescription("How many saves to donate").setRequired(true).setMinValue(1))
  )
  .addSubcommand(sub => sub.setName("guild-save").setDescription("Use a save from the guild pool (any member)"));

export async function execute(interaction) {
  const sub     = interaction.options.getSubcommand();
  const guildId = interaction.guildId;
  const userId  = interaction.user.id;

  if (sub === "set") {
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);
    const channel = interaction.options.getChannel("channel");

    const existing = countingChannels.get(guildId) || { currentCount: 0, highScore: 0, lastUserId: null, failedAt: 0 };
    existing.channelId = channel.id;
    countingChannels.set(guildId, existing);

    await upsertCountingConfig(guildId, {
      channel_id:    channel.id,
      current_count: existing.currentCount,
      high_score:    existing.highScore,
      last_user_id:  existing.lastUserId,
      failed_at:     existing.failedAt,
    });

    const embed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle("✦ Counting Channel Set")
      .setDescription(`${DIVIDER}\n📊 Counting is now active in ${channel}!\n\nSend numbers starting from **${existing.currentCount + 1}**.\nSame user cannot count twice in a row.\n${DIVIDER}`)
      .setFooter(FOOTER_MAIN)
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  if (sub === "info") {
    const cfg = countingChannels.get(guildId);
    if (!cfg) return interaction.reply({ content: "❌ No counting channel set. Use `/counting set` first.", ephemeral: true });

    const guildSaves = await getGuildSaves(guildId);
    const embed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle("✦ Counting Stats")
      .setDescription(
        `${DIVIDER}\n` +
        `**Channel:** <#${cfg.channelId}>\n` +
        `**Current Count:** ${cfg.currentCount}\n` +
        `**High Score:** ${cfg.highScore}\n` +
        `**Last Counter:** ${cfg.lastUserId ? `<@${cfg.lastUserId}>` : "Nobody yet"}\n` +
        `**Guild Saves:** ${guildSaves} 💾\n` +
        `${DIVIDER}`
      )
      .setFooter(FOOTER_MAIN)
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  if (sub === "save") {
    const action = interaction.options.getString("action");

    if (action === "status") {
      const saves  = await getCountingSaves(guildId, userId);
      const now    = Date.now();
      const nextDaily = saves.last_daily_claim + DAILY_MS;
      const canClaim = now >= nextDaily;

      const embed = new EmbedBuilder()
        .setColor(NILOU_RED)
        .setTitle("✦ Your Counting Saves")
        .setDescription(
          `${DIVIDER}\n` +
          `**Saves:** ${saves.saves} / ${MAX_PERSONAL_SAVES} 💾\n` +
          `**Daily Claim:** ${canClaim ? "✅ Ready to claim!" : `⏳ <t:${Math.floor(nextDaily / 1000)}:R>`}\n` +
          `**Buy Save:** 50 🎟️ Theater Credits\n` +
          `${DIVIDER}`
        )
        .setFooter(FOOTER_MAIN);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (action === "claim") {
      const saves = await getCountingSaves(guildId, userId);
      const now   = Date.now();
      if (now - saves.last_daily_claim < DAILY_MS) {
        const nextTs = Math.floor((saves.last_daily_claim + DAILY_MS) / 1000);
        return interaction.reply({ content: `⏳ Your daily save refreshes <t:${nextTs}:R>.`, ephemeral: true });
      }
      if (saves.saves >= MAX_PERSONAL_SAVES) {
        return interaction.reply({ content: `❌ You already have ${saves.saves}/${MAX_PERSONAL_SAVES} saves. Use some first!`, ephemeral: true });
      }
      await upsertCountingSaves(guildId, userId, { saves: saves.saves + 1, last_daily_claim: now });
      return interaction.reply({ content: `💾 Daily save claimed! You now have **${saves.saves + 1}/${MAX_PERSONAL_SAVES}** saves.`, ephemeral: true });
    }

    if (action === "buy") {
      const saves = await getCountingSaves(guildId, userId);
      if (saves.saves >= MAX_PERSONAL_SAVES) {
        return interaction.reply({ content: `❌ You are at max saves (${MAX_PERSONAL_SAVES}). Use one first!`, ephemeral: true });
      }
      const eco = await getEconomy(userId, guildId);
      if (Number(eco.theater_credits) < SAVE_BUY_COST) {
        return interaction.reply({ content: `❌ You need **${SAVE_BUY_COST} 🎟️ Theater Credits** but only have ${eco.theater_credits}.`, ephemeral: true });
      }
      await updateEconomy(userId, guildId, { theater_credits: Number(eco.theater_credits) - SAVE_BUY_COST });
      await upsertCountingSaves(guildId, userId, { saves: saves.saves + 1 });
      return interaction.reply({ content: `🎟️ Spent **${SAVE_BUY_COST} TC** to buy a save! You now have **${saves.saves + 1}/${MAX_PERSONAL_SAVES}** saves.`, ephemeral: true });
    }

    if (action === "use") {
      const saves = await getCountingSaves(guildId, userId);
      if (saves.saves <= 0) {
        return interaction.reply({ content: `❌ You have no saves! Claim your daily or buy one with 🎟️.`, ephemeral: true });
      }
      const cfg = countingChannels.get(guildId);
      if (!cfg) return interaction.reply({ content: "❌ No counting channel set.", ephemeral: true });
      if (cfg.failedAt === 0) return interaction.reply({ content: "❌ The count hasn't failed yet — no need to use a save!", ephemeral: true });

      const restored = cfg.failedAt;
      cfg.currentCount = restored;
      cfg.failedAt     = 0;
      countingChannels.set(guildId, cfg);

      await upsertCountingConfig(guildId, { current_count: restored, failed_at: 0, channel_id: cfg.channelId });
      await upsertCountingSaves(guildId, userId, { saves: saves.saves - 1 });

      const ch = await interaction.guild.channels.fetch(cfg.channelId).catch(() => null);
      if (ch) await ch.send(`💾 **${interaction.user.tag}** used a personal save! The count has been restored to **${restored}**. Next number: **${restored + 1}**`);

      return interaction.reply({ content: `💾 Save used! Count restored to **${restored}**.`, ephemeral: true });
    }
  }

  if (sub === "donate") {
    const amount = interaction.options.getInteger("amount");
    const saves  = await getCountingSaves(guildId, userId);
    if (saves.saves < amount) {
      return interaction.reply({ content: `❌ You only have **${saves.saves}** saves. Can't donate ${amount}.`, ephemeral: true });
    }
    const guildSaves = await getGuildSaves(guildId);
    await upsertCountingSaves(guildId, userId, { saves: saves.saves - amount });
    await setGuildSaves(guildId, guildSaves + amount);

    return interaction.reply({
      content: `💝 Donated **${amount}** save${amount > 1 ? "s" : ""} to the guild pool! Guild now has **${guildSaves + amount}** saves. 🌸`,
    });
  }

  if (sub === "guild-save") {
    const guildSaves = await getGuildSaves(guildId);
    if (guildSaves <= 0) {
      return interaction.reply({ content: "❌ The guild has no saves in the pool. Donate some with `/counting donate`!", ephemeral: true });
    }
    const cfg = countingChannels.get(guildId);
    if (!cfg) return interaction.reply({ content: "❌ No counting channel set.", ephemeral: true });
    if (cfg.failedAt === 0) return interaction.reply({ content: "❌ The count hasn't failed — no need for a guild save!", ephemeral: true });

    const restored   = cfg.failedAt;
    cfg.currentCount = restored;
    cfg.failedAt     = 0;
    countingChannels.set(guildId, cfg);

    await upsertCountingConfig(guildId, { current_count: restored, failed_at: 0, channel_id: cfg.channelId });
    await setGuildSaves(guildId, guildSaves - 1);

    const ch = await interaction.guild.channels.fetch(cfg.channelId).catch(() => null);
    if (ch) await ch.send(`🌸 **${interaction.user.tag}** used a **Guild Save**! Count restored to **${restored}**. Next: **${restored + 1}**\n*(${guildSaves - 1} guild saves remaining)*`);

    return interaction.reply({ content: `✅ Guild save used! Count restored to **${restored}**.`, ephemeral: true });
  }
}
