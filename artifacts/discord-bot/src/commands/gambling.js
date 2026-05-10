import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { NILOU_RED, FOOTER_MAIN, DIVIDER } from "../theme.js";
import { getEconomy, updateEconomy } from "../db/index.js";

const COOLDOWN   = 60 * 1000;
const cooldowns  = new Map();

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function checkCooldown(userId, action) {
  const key  = `${userId}:${action}`;
  const last = cooldowns.get(key) || 0;
  const diff = Date.now() - last;
  if (diff < COOLDOWN) return Math.ceil((COOLDOWN - diff) / 1000);
  cooldowns.set(key, Date.now());
  return 0;
}

const SLOTS_SYMBOLS = ["🌸","💎","⭐","🎭","🌙","🎟️","🌊","🏆"];

export const data = new SlashCommandBuilder()
  .setName("gamble")
  .setDescription("Theater Gambling Hall 🎲")
  .addSubcommand(sub =>
    sub.setName("bet").setDescription("Bet your coins on a coin flip")
      .addIntegerOption(o => o.setName("amount").setDescription("Amount to bet (💠 coins)").setRequired(true).setMinValue(10))
      .addStringOption(o => o.setName("side").setDescription("Heads or tails?").setRequired(true)
        .addChoices({ name: "🌸 Heads", value: "heads" }, { name: "💧 Tails", value: "tails" }))
  )
  .addSubcommand(sub =>
    sub.setName("slots").setDescription("Spin the Theater slot machine!")
      .addIntegerOption(o => o.setName("amount").setDescription("Amount to bet (💠 coins)").setRequired(true).setMinValue(10))
  )
  .addSubcommand(sub =>
    sub.setName("roulette").setDescription("Place a roulette bet")
      .addIntegerOption(o => o.setName("amount").setDescription("Amount to bet (💠 coins)").setRequired(true).setMinValue(10))
      .addStringOption(o => o.setName("bet_type").setDescription("Your bet").setRequired(true)
        .addChoices(
          { name: "🔴 Red (2×)",   value: "red"   },
          { name: "⚫ Black (2×)", value: "black" },
          { name: "🟢 Green (14×)",value: "green" },
        ))
  )
  .addSubcommand(sub =>
    sub.setName("credits").setDescription("Bet Theater Credits instead of coins")
      .addIntegerOption(o => o.setName("amount").setDescription("🎟️ Theater Credits to bet").setRequired(true).setMinValue(5))
      .addStringOption(o => o.setName("side").setDescription("Heads or tails?").setRequired(true)
        .addChoices({ name: "🌸 Heads", value: "heads" }, { name: "💧 Tails", value: "tails" }))
  );

export async function execute(interaction) {
  const sub     = interaction.options.getSubcommand();
  const userId  = interaction.user.id;
  const guildId = interaction.guildId;

  const cd = checkCooldown(userId, sub);
  if (cd) return interaction.reply({ content: `⏳ Cooldown! Wait **${cd}s** before gambling again.`, ephemeral: true });

  await interaction.deferReply();
  const eco = await getEconomy(userId, guildId);

  if (sub === "bet" || sub === "credits") {
    const amount   = interaction.options.getInteger("amount");
    const side     = interaction.options.getString("side");
    const currency = sub === "credits" ? "theater_credits" : "coins";
    const balance  = Number(eco[currency]);

    if (balance < amount) return interaction.editReply({ content: `❌ Not enough ${currency === "theater_credits" ? "🎟️ Theater Credits" : "💠 coins"}!` });

    const result = Math.random() < 0.5 ? "heads" : "tails";
    const won    = result === side;
    const delta  = won ? amount : -amount;

    await updateEconomy(userId, guildId, { [currency]: balance + delta });

    const embed = new EmbedBuilder().setColor(won ? 0x2ecc71 : 0xe74c3c)
      .setTitle(won ? "✦ You Won! 🎉" : "✦ You Lost 💧")
      .setDescription(
        `${DIVIDER}\n` +
        `The coin landed on **${result === "heads" ? "🌸 Heads" : "💧 Tails"}**!\n\n` +
        `${won ? `+${amount.toLocaleString()}` : `-${amount.toLocaleString()}`} ${currency === "theater_credits" ? "🎟️" : "💠"}\n` +
        `New balance: **${(balance + delta).toLocaleString()}**\n` +
        `${DIVIDER}`
      )
      .setFooter(FOOTER_MAIN).setTimestamp();
    return interaction.editReply({ embeds: [embed] });
  }

  if (sub === "slots") {
    const amount  = interaction.options.getInteger("amount");
    const balance = Number(eco.coins);
    if (balance < amount) return interaction.editReply({ content: "❌ Not enough 💠 coins!" });

    const reels = [0,1,2].map(() => SLOTS_SYMBOLS[rand(0, SLOTS_SYMBOLS.length - 1)]);
    const [a,b,c] = reels;
    let mult = 0;
    if (a === b && b === c) {
      mult = a === "🏆" ? 50 : a === "💎" ? 20 : a === "🎟️" ? 10 : 5;
    } else if (a === b || b === c || a === c) {
      mult = 2;
    }

    const won   = mult > 0;
    const gain  = won ? amount * mult - amount : -amount;
    await updateEconomy(userId, guildId, { coins: balance + gain });

    const embed = new EmbedBuilder().setColor(won ? 0xf1c40f : 0xe74c3c)
      .setTitle(won ? `✦ JACKPOT! ${mult}× 🎰` : "✦ No Match 💧")
      .setDescription(
        `${DIVIDER}\n` +
        `[ ${a} | ${b} | ${c} ]\n\n` +
        (won ? `+${(gain).toLocaleString()} 💠 (${mult}× multiplier!)` : `-${amount.toLocaleString()} 💠`) + "\n" +
        `New balance: **${(balance + gain).toLocaleString()}** 💠\n` +
        `${DIVIDER}`
      )
      .setFooter(FOOTER_MAIN).setTimestamp();
    return interaction.editReply({ embeds: [embed] });
  }

  if (sub === "roulette") {
    const amount   = interaction.options.getInteger("amount");
    const betType  = interaction.options.getString("bet_type");
    const balance  = Number(eco.coins);
    if (balance < amount) return interaction.editReply({ content: "❌ Not enough 💠 coins!" });

    const number = rand(0, 36);
    const isRed   = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(number);
    const isGreen = number === 0;
    const isBlack = !isRed && !isGreen;

    let won = false, mult = 1;
    if (betType === "red"   && isRed)   { won = true; mult = 2; }
    if (betType === "black" && isBlack) { won = true; mult = 2; }
    if (betType === "green" && isGreen) { won = true; mult = 14; }

    const gain = won ? amount * mult - amount : -amount;
    await updateEconomy(userId, guildId, { coins: balance + gain });

    const ballColor = isGreen ? "🟢" : isRed ? "🔴" : "⚫";
    const embed = new EmbedBuilder().setColor(won ? 0x2ecc71 : 0xe74c3c)
      .setTitle(won ? "✦ Roulette Win! 🎡" : "✦ Roulette Loss 💧")
      .setDescription(
        `${DIVIDER}\n` +
        `Ball landed on **${ballColor} ${number}**!\n\n` +
        (won ? `+${gain.toLocaleString()} 💠 (${mult}× payout)` : `-${amount.toLocaleString()} 💠`) + "\n" +
        `New balance: **${(balance + gain).toLocaleString()}** 💠\n` +
        `${DIVIDER}`
      )
      .setFooter(FOOTER_MAIN).setTimestamp();
    return interaction.editReply({ embeds: [embed] });
  }
}
