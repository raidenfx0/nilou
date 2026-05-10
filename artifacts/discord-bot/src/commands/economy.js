import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { NILOU_RED, FOOTER_MAIN, DIVIDER } from "../theme.js";
import { getEconomy, updateEconomy, getLeaderboard } from "../db/index.js";

const RANKS = [
  { name: "Beginner",  minLevel: 1  },
  { name: "Performer", minLevel: 5  },
  { name: "Star",      minLevel: 10 },
  { name: "Icon",      minLevel: 20 },
  { name: "Legend",    minLevel: 35 },
];

const PERFORM_COOLDOWN  = 30 * 60 * 1000;
const PERFORM_COINS_MIN = 50;
const PERFORM_COINS_MAX = 200;
const PERFORM_TC_MIN    = 5;
const PERFORM_TC_MAX    = 30;
const PERFORM_FAME_MIN  = 10;
const PERFORM_FAME_MAX  = 50;
const EXP_PER_LEVEL     = 500;

const SHOP_ITEMS = [
  { id: "grace_blessing",  name: "Grace Blessing 🌸",   price: 500,   tcPrice: 50,   desc: "Doubles your next /perform reward." },
  { id: "moonlit_applause",name: "Moonlit Applause 🌙",  price: 1000,  tcPrice: 100,  desc: "+20% EXP for 1 hour." },
  { id: "stage_relic",     name: "Stage Relic ⭐",       price: 2000,  tcPrice: 200,  desc: "A rare collectible from the Zubayr Theater." },
  { id: "golden_prop",     name: "Golden Prop 🏆",       price: 5000,  tcPrice: 500,  desc: "A legendary theater artifact." },
  { id: "costume_nilou",   name: "Nilou Costume 👗",     price: 10000, tcPrice: 1000, desc: "Wear the outfit of the Divine Damsel herself." },
];

function getRank(level) {
  return [...RANKS].reverse().find(r => level >= r.minLevel)?.name || "Beginner";
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export const data = new SlashCommandBuilder()
  .setName("economy")
  .setDescription("Zubayr Theater Economy")
  .addSubcommand(sub => sub.setName("balance").setDescription("Check your coins and Theater Credits"))
  .addSubcommand(sub =>
    sub.setName("perform").setDescription("Perform on stage to earn coins, credits, and fame!")
  )
  .addSubcommand(sub =>
    sub.setName("profile").setDescription("View your full economy profile")
      .addUserOption(o => o.setName("user").setDescription("View another user").setRequired(false))
  )
  .addSubcommand(sub => sub.setName("shop").setDescription("Browse the Zubayr Theater shop"))
  .addSubcommand(sub =>
    sub.setName("buy").setDescription("Buy an item from the shop")
      .addStringOption(o => o.setName("item").setDescription("Item ID to buy").setRequired(true)
        .addChoices(...SHOP_ITEMS.map(i => ({ name: i.name, value: i.id }))))
      .addStringOption(o => o.setName("currency").setDescription("Pay with coins or theater_credits")
        .addChoices({ name: "💠 Coins", value: "coins" }, { name: "🎟️ Theater Credits", value: "theater_credits" }))
  )
  .addSubcommand(sub =>
    sub.setName("inventory").setDescription("View your inventory")
      .addUserOption(o => o.setName("user").setDescription("View another user's inventory").setRequired(false))
  )
  .addSubcommand(sub =>
    sub.setName("leaderboard").setDescription("Top performers in this server")
      .addStringOption(o => o.setName("type").setDescription("Sort by")
        .addChoices(
          { name: "💠 Coins",           value: "coins"           },
          { name: "🎟️ Theater Credits", value: "theater_credits" },
          { name: "🎭 Fame",            value: "fame"            },
          { name: "⭐ EXP",             value: "exp"             }
        ))
  );

export async function execute(interaction) {
  const sub     = interaction.options.getSubcommand();
  const userId  = interaction.user.id;
  const guildId = interaction.guildId;

  if (sub === "balance") {
    const eco = await getEconomy(userId, guildId);
    const embed = new EmbedBuilder().setColor(NILOU_RED)
      .setTitle(`✦ ${interaction.user.username}'s Balance`)
      .setDescription(`${DIVIDER}\n💠 Coins: **${Number(eco.coins).toLocaleString()}**\n🎟️ Theater Credits: **${Number(eco.theater_credits).toLocaleString()}**\n🎭 Fame: **${Number(eco.fame).toLocaleString()}**\n${DIVIDER}`)
      .setFooter(FOOTER_MAIN).setTimestamp();
    return interaction.reply({ embeds: [embed] });
  }

  if (sub === "perform") {
    await interaction.deferReply();
    const eco  = await getEconomy(userId, guildId);
    const now  = Date.now();
    const last = Number(eco.last_perform);

    if (now - last < PERFORM_COOLDOWN) {
      const remaining = Math.ceil((PERFORM_COOLDOWN - (now - last)) / 60000);
      return interaction.editReply({ content: `🌸 You need to rest before performing again! Come back in **${remaining} min**.` });
    }

    const inventory = JSON.parse(eco.inventory || "[]");
    const hasGrace  = inventory.includes("grace_blessing");
    const mult      = hasGrace ? 2 : 1;
    if (hasGrace) {
      const idx = inventory.indexOf("grace_blessing");
      inventory.splice(idx, 1);
    }

    const earned_coins = rand(PERFORM_COINS_MIN, PERFORM_COINS_MAX) * mult;
    const earned_tc    = rand(PERFORM_TC_MIN,    PERFORM_TC_MAX)    * mult;
    const earned_fame  = rand(PERFORM_FAME_MIN,  PERFORM_FAME_MAX)  * mult;
    const earned_exp   = rand(20, 60);

    const new_coins = Number(eco.coins)           + earned_coins;
    const new_tc    = Number(eco.theater_credits)  + earned_tc;
    const new_fame  = Number(eco.fame)             + earned_fame;
    const new_exp   = Number(eco.exp)              + earned_exp;
    const new_level = Math.max(eco.level, Math.floor(new_exp / EXP_PER_LEVEL) + 1);
    const new_rank  = getRank(new_level);
    const levelUp   = new_level > eco.level;

    await updateEconomy(userId, guildId, {
      coins:           new_coins,
      theater_credits: new_tc,
      fame:            new_fame,
      exp:             new_exp,
      level:           new_level,
      rank:            new_rank,
      last_perform:    now,
      inventory:       JSON.stringify(inventory),
    });

    const PERFORMANCES = [
      "danced the Nilou special at the Grand Stage",
      "performed a flawless water ballet",
      "led the opening act at the Zubayr Theater",
      "enchanted the audience with a solo performance",
      "brought tears to the crowd with an emotional dance",
    ];
    const perf = PERFORMANCES[Math.floor(Math.random() * PERFORMANCES.length)];

    const embed = new EmbedBuilder().setColor(NILOU_RED)
      .setTitle("✦ Performance Complete!")
      .setDescription(
        `${DIVIDER}\n` +
        `🌸 ${interaction.user} ${perf}!\n\n` +
        `💠 **+${earned_coins}** coins${hasGrace ? " (×2 Grace!)" : ""}\n` +
        `🎟️ **+${earned_tc}** Theater Credits\n` +
        `🎭 **+${earned_fame}** Fame\n` +
        `⭐ **+${earned_exp}** EXP\n\n` +
        `Total: ${new_coins.toLocaleString()} 💠 · ${new_tc.toLocaleString()} 🎟️ · Lv.${new_level} ${new_rank}` +
        (levelUp ? `\n\n🎉 **LEVEL UP!** You are now Level ${new_level} — ${new_rank}!` : "") +
        `\n${DIVIDER}`
      )
      .setFooter(FOOTER_MAIN).setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }

  if (sub === "profile") {
    const target = interaction.options.getUser("user") || interaction.user;
    await interaction.deferReply();
    const eco  = await getEconomy(target.id, guildId);
    const inv  = JSON.parse(eco.inventory || "[]");
    const nextLevelExp = eco.level * EXP_PER_LEVEL;
    const expProgress  = ((Number(eco.exp) % EXP_PER_LEVEL) / EXP_PER_LEVEL * 100).toFixed(1);

    const embed = new EmbedBuilder().setColor(NILOU_RED)
      .setTitle(`✦ ${target.username}'s Theater Profile`)
      .setDescription(`${DIVIDER}\n🎭 **${eco.rank}** · Level **${eco.level}**\n${DIVIDER}`)
      .addFields(
        { name: "💠 Coins",            value: Number(eco.coins).toLocaleString(),           inline: true },
        { name: "🎟️ Theater Credits", value: Number(eco.theater_credits).toLocaleString(),  inline: true },
        { name: "🎭 Fame",             value: Number(eco.fame).toLocaleString(),             inline: true },
        { name: "⭐ EXP",              value: `${Number(eco.exp).toLocaleString()} (${expProgress}% to next level)`, inline: false },
        { name: "🎒 Inventory",        value: inv.length > 0 ? inv.map(i => SHOP_ITEMS.find(s => s.id === i)?.name || i).join(", ") : "Empty", inline: false },
      )
      .setFooter(FOOTER_MAIN).setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }

  if (sub === "shop") {
    const embed = new EmbedBuilder().setColor(NILOU_RED)
      .setTitle("✦ Zubayr Theater Shop 🛍️")
      .setDescription(`${DIVIDER}\n🌸 Welcome to Menakeri's Treasure Shop! Browse and use \`/economy buy\`.\n${DIVIDER}`)
      .addFields(SHOP_ITEMS.map(item => ({
        name: `${item.name} · ${item.price.toLocaleString()} 💠 / ${item.tcPrice.toLocaleString()} 🎟️`,
        value: `ID: \`${item.id}\` — ${item.desc}`,
        inline: false,
      })))
      .setFooter(FOOTER_MAIN).setTimestamp();
    return interaction.reply({ embeds: [embed] });
  }

  if (sub === "buy") {
    const itemId   = interaction.options.getString("item");
    const currency = interaction.options.getString("currency") || "coins";
    const item     = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return interaction.reply({ content: "❌ Item not found.", ephemeral: true });

    await interaction.deferReply({ ephemeral: true });
    const eco     = await getEconomy(userId, guildId);
    const price   = currency === "theater_credits" ? item.tcPrice : item.price;
    const balance = Number(eco[currency]);

    if (balance < price) return interaction.editReply({ content: `❌ Not enough ${currency === "theater_credits" ? "🎟️ Theater Credits" : "💠 coins"}! You have ${balance.toLocaleString()} but need ${price.toLocaleString()}.` });

    const inventory = JSON.parse(eco.inventory || "[]");
    inventory.push(itemId);
    await updateEconomy(userId, guildId, {
      [currency]: balance - price,
      inventory:  JSON.stringify(inventory),
    });

    return interaction.editReply({ content: `🌸 You bought **${item.name}**! ${item.desc} Check your inventory with \`/economy inventory\`.` });
  }

  if (sub === "inventory") {
    const target = interaction.options.getUser("user") || interaction.user;
    const eco    = await getEconomy(target.id, guildId);
    const inv    = JSON.parse(eco.inventory || "[]");
    const embed  = new EmbedBuilder().setColor(NILOU_RED)
      .setTitle(`✦ ${target.username}'s Inventory`)
      .setDescription(inv.length === 0
        ? `${DIVIDER}\n🌸 No items yet! Visit the \`/economy shop\`.\n${DIVIDER}`
        : `${DIVIDER}\n${inv.map(id => {
            const item = SHOP_ITEMS.find(s => s.id === id);
            return item ? `${item.name} — ${item.desc}` : `Unknown: ${id}`;
          }).join("\n")}\n${DIVIDER}`
      )
      .setFooter(FOOTER_MAIN).setTimestamp();
    return interaction.reply({ embeds: [embed] });
  }

  if (sub === "leaderboard") {
    const type   = interaction.options.getString("type") || "coins";
    const rows   = await getLeaderboard(guildId, type, 10);
    const labels = { coins: "💠 Coins", theater_credits: "🎟️ Theater Credits", fame: "🎭 Fame", exp: "⭐ EXP" };
    const embed  = new EmbedBuilder().setColor(NILOU_RED)
      .setTitle(`✦ Leaderboard — ${labels[type]}`)
      .setDescription(
        rows.length === 0
          ? "No data yet!"
          : rows.map((r, i) =>
              `${["🥇","🥈","🥉"][i]||`**${i+1}.**`} <@${r.user_id}> — **${Number(r[type]).toLocaleString()}**`
            ).join("\n")
      )
      .setFooter(FOOTER_MAIN).setTimestamp();
    return interaction.reply({ embeds: [embed] });
  }
}
