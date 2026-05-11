import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from "discord.js";
import { pendingDrops } from "../data/store.js";
import { getEconomy, updateEconomy } from "../db/index.js";
import { NILOU_RED, FOOTER_MAIN, DIVIDER } from "../theme.js";

export const data = new SlashCommandBuilder()
  .setName("collect")
  .setDescription("Collect a Theater drop that appeared in this channel — first to act wins!");

export async function execute(interaction) {
  const channelId = interaction.channelId;
  const drop = pendingDrops.get(channelId);

  if (!drop || Date.now() > drop.expiry) {
    pendingDrops.delete(channelId);
    return interaction.reply({
      content: "💧 There's nothing to collect right now. Watch the channel for the next Theater drop!",
      ephemeral: true,
    });
  }

  // Claim it immediately to prevent race conditions
  pendingDrops.delete(channelId);

  const userId  = interaction.user.id;
  const guildId = interaction.guildId;

  const eco = await getEconomy(userId, guildId);
  const updates = {};

  let rewardText = "";

  if (drop.type === "coins") {
    updates.coins = Number(eco.coins) + drop.amount;
    rewardText = `💠 **+${drop.amount.toLocaleString()} Coins**`;
  } else if (drop.type === "tc") {
    updates.theater_credits = Number(eco.theater_credits) + drop.amount;
    rewardText = `🎟️ **+${drop.amount.toLocaleString()} Theater Credits**`;
  } else if (drop.type === "fame") {
    updates.fame = Number(eco.fame) + drop.amount;
    rewardText = `🎭 **+${drop.amount.toLocaleString()} Fame**`;
  } else if (drop.type === "item") {
    const inv = JSON.parse(eco.inventory || "[]");
    inv.push(drop.itemId);
    updates.inventory = JSON.stringify(inv);
    rewardText = `🎁 **${drop.itemName}** added to your inventory!`;
  }

  await updateEconomy(userId, guildId, updates);

  // Delete the drop message
  if (drop.msgId) {
    try {
      const ch  = await interaction.guild.channels.fetch(channelId);
      const msg = await ch.messages.fetch(drop.msgId);
      await msg.delete();
    } catch {}
  }

  const embed = new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle("✦ You collected the Theater drop! 🎉")
    .setDescription(`${DIVIDER}\n${rewardText}\n\n${interaction.user} was first to the stage!\n${DIVIDER}`)
    .setFooter(FOOTER_MAIN)
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
