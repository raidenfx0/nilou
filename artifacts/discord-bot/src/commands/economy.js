import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from "discord.js";
import { NILOU_RED, FOOTER_MAIN, DIVIDER } from "../theme.js";
import { getEconomy, updateEconomy, getLeaderboard } from "../db/index.js";
import { createLevelCard } from "../utils/levelCard.js";

// ─── Constants ────────────────────────────────────────────────────────────────
const RANKS = [
  { name: "Stagehand",  minLevel: 1  },
  { name: "Performer",  minLevel: 5  },
  { name: "Soloist",    minLevel: 10 },
  { name: "Star",       minLevel: 20 },
  { name: "Idol",       minLevel: 35 },
  { name: "Legend",     minLevel: 50 },
];

const LEVELS = [0, 100, 300, 600, 1100, 1800, 2700, 3800, 5200, 7000, 9200,
  12000, 15500, 19700, 24800, 31000, 38500, 47500, 58000, 70500, 85000];

const PERFORM_CD  = 30 * 60 * 1000;
const WORK_CD     = 4  * 60 * 60 * 1000;
const DAILY_CD    = 24 * 60 * 60 * 1000;
const DAILY_GRACE = 48 * 60 * 60 * 1000;

const DAILY_BASE_COINS = 200;
const DAILY_BASE_TC    = 20;

const SHOP_ITEMS = [
  { id: "grace_blessing",   name: "Grace Blessing 🌸",     price: 500,   tcPrice: 50,   desc: "Doubles your next /perform reward.", consumable: true },
  { id: "moonlit_applause", name: "Moonlit Applause 🌙",   price: 1000,  tcPrice: 100,  desc: "+20% EXP for 1 hour.", consumable: true },
  { id: "stage_relic",      name: "Stage Relic ⭐",         price: 2000,  tcPrice: 200,  desc: "A rare collectible from the Zubayr Theater.", consumable: false },
  { id: "golden_prop",      name: "Golden Prop 🏆",         price: 5000,  tcPrice: 500,  desc: "A legendary theater artifact.", consumable: false },
  { id: "padisarah_bouquet",name: "Padisarah Bouquet 🌺",  price: 800,   tcPrice: 80,   desc: "+50% coins from next collect drop.", consumable: true },
  { id: "curtain_call",     name: "Curtain Call 🎪",        price: 3000,  tcPrice: 300,  desc: "+100% fame for 24 hours.", consumable: true },
  { id: "costume_nilou",    name: "Nilou Costume 👗",       price: 10000, tcPrice: 1000, desc: "Wear the outfit of the Divine Damsel herself.", consumable: false },
];

function getRank(level) { return [...RANKS].reverse().find(r => level >= r.minLevel)?.name || "Stagehand"; }
function rand(min, max)  { return Math.floor(Math.random() * (max - min + 1)) + min; }
function getLevelFromExp(exp) {
  let lv = 1;
  for (let i = 1; i < LEVELS.length; i++) {
    if (exp >= LEVELS[i]) lv = i + 1; else break;
  }
  return lv;
}
function getExpForLevel(lv) { return LEVELS[Math.min(lv, LEVELS.length - 1)] || LEVELS[LEVELS.length - 1]; }
function fmt(n) { return Number(n).toLocaleString(); }

// ─── Builder ──────────────────────────────────────────────────────────────────
export const data = new SlashCommandBuilder()
  .setName("economy")
  .setDescription("Zubayr Theater Economy")
  .addSubcommand(s => s.setName("balance").setDescription("Check your coins and Theater Credits"))
  .addSubcommand(s => s.setName("daily").setDescription("Claim your daily Theater reward (streaks give bonuses!)"))
  .addSubcommand(s =>
    s.setName("perform").setDescription("Perform on stage — earn coins, credits, and fame! (30m cooldown)")
  )
  .addSubcommand(s => s.setName("work").setDescription("Do a quick shift at the theater (4h cooldown)"))
  .addSubcommand(s =>
    s.setName("profile").setDescription("View your full theater profile")
      .addUserOption(o => o.setName("user").setDescription("View another user's profile").setRequired(false))
  )
  .addSubcommand(s => s.setName("shop").setDescription("Browse Menakeri's Treasure Shop"))
  .addSubcommand(s =>
    s.setName("buy").setDescription("Buy an item from the shop")
      .addStringOption(o => o.setName("item").setDescription("Item to buy").setRequired(true)
        .addChoices(...SHOP_ITEMS.map(i => ({ name: i.name, value: i.id }))))
      .addStringOption(o => o.setName("currency").setDescription("Pay with coins or Theater Credits")
        .addChoices({ name: "💠 Coins", value: "coins" }, { name: "🎟️ Theater Credits", value: "theater_credits" }))
  )
  .addSubcommand(s =>
    s.setName("inventory").setDescription("View your inventory")
      .addUserOption(o => o.setName("user").setDescription("View another user's inventory").setRequired(false))
  )
  .addSubcommand(s =>
    s.setName("transfer").setDescription("Transfer coins to another user")
      .addUserOption(o => o.setName("user").setDescription("Who to send coins to").setRequired(true))
      .addIntegerOption(o => o.setName("amount").setDescription("Amount of coins to send").setRequired(true).setMinValue(1))
  )
  .addSubcommand(s =>
    s.setName("leaderboard").setDescription("Top performers in this server")
      .addStringOption(o => o.setName("type").setDescription("Sort by")
        .addChoices(
          { name: "💠 Coins",           value: "coins"           },
          { name: "🎟️ Theater Credits", value: "theater_credits" },
          { name: "🎭 Fame",            value: "fame"            },
          { name: "⭐ EXP",             value: "exp"             },
        ))
  );

// ─── Execute ──────────────────────────────────────────────────────────────────
export async function execute(interaction) {
  const sub     = interaction.options.getSubcommand();
  const userId  = interaction.user.id;
  const guildId = interaction.guildId;

  // ── Balance ─────────────────────────────────────────────────────────────────
  if (sub === "balance") {
    const eco = await getEconomy(userId, guildId);
    const lv  = getLevelFromExp(Number(eco.exp));
    const nextExp = getExpForLevel(lv);
    const progress = nextExp > 0 ? Math.min(100, Math.round((Number(eco.exp) / nextExp) * 100)) : 100;
    const bar = "█".repeat(Math.floor(progress / 5)) + "░".repeat(20 - Math.floor(progress / 5));

    const embed = new EmbedBuilder().setColor(NILOU_RED)
      .setTitle(`✦ ${interaction.user.username}'s Balance`)
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setDescription(
        `${DIVIDER}\n` +
        `💠 Coins: **${fmt(eco.coins)}**\n` +
        `🎟️ Theater Credits: **${fmt(eco.theater_credits)}**\n` +
        `🎭 Fame: **${fmt(eco.fame)}**\n` +
        `${DIVIDER}`
      )
      .addFields(
        { name: "⭐ Level", value: `**${lv}** — ${getRank(lv)}`, inline: true },
        { name: "📈 EXP Progress", value: `${fmt(eco.exp)} / ${fmt(nextExp)}\n\`${bar}\` ${progress}%`, inline: false },
        { name: "🔥 Daily Streak", value: `**${eco.daily_streak || 0}** days`, inline: true },
      )
      .setFooter(FOOTER_MAIN).setTimestamp();
    return interaction.reply({ embeds: [embed] });
  }

  // ── Daily ────────────────────────────────────────────────────────────────────
  if (sub === "daily") {
    const eco  = await getEconomy(userId, guildId);
    const now  = Date.now();
    const last = Number(eco.last_daily || 0);
    const remaining = DAILY_CD - (now - last);

    if (remaining > 0) {
      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      return interaction.reply({
        content: `⏳ Your daily reward resets in **${h}h ${m}m**. Come back then!`,
        ephemeral: true,
      });
    }

    // Streak: increment if collected within 48h, reset if missed
    const streak = (now - last < DAILY_GRACE && last > 0)
      ? (Number(eco.daily_streak || 0) + 1)
      : 1;

    const streakBonus  = Math.min(streak * 0.05, 1.5); // max +150%
    const coinsEarned  = Math.round((DAILY_BASE_COINS + rand(50, 150)) * (1 + streakBonus));
    const tcEarned     = Math.round((DAILY_BASE_TC   + rand(5,  30))  * (1 + streakBonus * 0.5));
    const expEarned    = rand(10, 30);

    const newCoins = Number(eco.coins)           + coinsEarned;
    const newTC    = Number(eco.theater_credits)  + tcEarned;
    const newExp   = Number(eco.exp)              + expEarned;
    const oldLevel = getLevelFromExp(Number(eco.exp));
    const newLevel = getLevelFromExp(newExp);

    await updateEconomy(userId, guildId, {
      coins:           newCoins,
      theater_credits: newTC,
      exp:             newExp,
      level:           newLevel,
      rank:            getRank(newLevel),
      last_daily:      now,
      daily_streak:    streak,
    });

    const milestones = { 7: "🎁 **7-day bonus!**", 30: "💎 **30-day legend!**", 100: "👑 **100-day crown!**" };
    const milestone  = milestones[streak] || "";

    const embed = new EmbedBuilder().setColor(NILOU_RED)
      .setTitle("✦ Daily Theater Reward 🌸")
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setDescription(
        `${DIVIDER}\n` +
        `**${interaction.user.username}** collected their daily reward!\n\n` +
        `💠 **+${fmt(coinsEarned)}** Coins\n` +
        `🎟️ **+${tcEarned}** Theater Credits\n` +
        `⭐ **+${expEarned}** EXP\n` +
        (streakBonus > 0 ? `\n✨ **Streak Bonus:** +${Math.round(streakBonus * 100)}%\n` : "") +
        (milestone ? `\n${milestone}\n` : "") +
        `${DIVIDER}`
      )
      .addFields(
        { name: "🔥 Streak", value: `**${streak}** day${streak !== 1 ? "s" : ""}`, inline: true },
        { name: "💰 New Balance", value: `**${fmt(newCoins)}** 💠`, inline: true },
      )
      .setFooter(FOOTER_MAIN).setTimestamp();

    // Level up image if leveled
    if (newLevel > oldLevel) {
      try {
        const buf  = await createLevelCard({
          username:    interaction.user.username,
          avatarUrl:   interaction.user.displayAvatarURL({ extension: "png", size: 256 }),
          level:       newLevel,
          rewardLines: [`💠 +${fmt(coinsEarned)} Coins · 🎟️ +${tcEarned} TC`, `🔥 ${streak}-day streak · ${getRank(newLevel)}`],
        });
        const file = new AttachmentBuilder(buf, { name: "levelup.png" });
        embed.setImage("attachment://levelup.png");
        return interaction.reply({ embeds: [embed], files: [file] });
      } catch {}
    }

    return interaction.reply({ embeds: [embed] });
  }

  // ── Perform ──────────────────────────────────────────────────────────────────
  if (sub === "perform") {
    await interaction.deferReply();
    const eco  = await getEconomy(userId, guildId);
    const now  = Date.now();
    const last = Number(eco.last_perform);

    if (now - last < PERFORM_CD) {
      const remaining = Math.ceil((PERFORM_CD - (now - last)) / 60000);
      return interaction.editReply({ content: `🌸 Rest before performing again! Come back in **${remaining} min**.` });
    }

    const inventory = JSON.parse(eco.inventory || "[]");
    const hasGrace  = inventory.includes("grace_blessing");
    const mult      = hasGrace ? 2 : 1;
    if (hasGrace) inventory.splice(inventory.indexOf("grace_blessing"), 1);

    const coins = rand(80, 300) * mult;
    const tc    = rand(8, 40)   * mult;
    const fame  = rand(15, 60)  * mult;
    const exp   = rand(30, 80);

    const oldExp   = Number(eco.exp);
    const newExp   = oldExp + exp;
    const oldLevel = getLevelFromExp(oldExp);
    const newLevel = getLevelFromExp(newExp);
    const levelUp  = newLevel > oldLevel;

    const PERFORMANCES = [
      "danced the Nilou special at the Grand Stage",
      "performed a breathtaking water ballet",
      "led the opening act at the Zubayr Theater",
      "enchanted the crowd with a solo dance",
      "brought tears to every eye with an emotional performance",
      "twirled through a Padisarah storm on the main stage",
      "wowed the Grand Bazaar crowd with an impromptu show",
    ];
    const perf = PERFORMANCES[Math.floor(Math.random() * PERFORMANCES.length)];

    await updateEconomy(userId, guildId, {
      coins:           Number(eco.coins)           + coins,
      theater_credits: Number(eco.theater_credits)  + tc,
      fame:            Number(eco.fame)             + fame,
      exp:             newExp,
      level:           newLevel,
      rank:            getRank(newLevel),
      last_perform:    now,
      inventory:       JSON.stringify(inventory),
    });

    const embed = new EmbedBuilder().setColor(NILOU_RED)
      .setTitle("✦ Performance Complete! 🎭")
      .setDescription(
        `${DIVIDER}\n` +
        `🌸 ${interaction.user} ${perf}!\n\n` +
        `💠 **+${fmt(coins)}** Coins${hasGrace ? " *(×2 Grace!)*" : ""}\n` +
        `🎟️ **+${tc}** Theater Credits\n` +
        `🎭 **+${fame}** Fame\n` +
        `⭐ **+${exp}** EXP\n\n` +
        `Balance: **${fmt(Number(eco.coins) + coins)}** 💠 · Level **${newLevel}** ${getRank(newLevel)}` +
        `\n${DIVIDER}`
      )
      .setFooter(FOOTER_MAIN).setTimestamp();

    if (levelUp) {
      try {
        const buf  = await createLevelCard({
          username:    interaction.user.username,
          avatarUrl:   interaction.user.displayAvatarURL({ extension: "png", size: 256 }),
          level:       newLevel,
          rewardLines: [`💠 +${fmt(coins)} · 🎟️ +${tc} · 🎭 +${fame}`, `Rank: ${getRank(newLevel)}`],
        });
        const file = new AttachmentBuilder(buf, { name: "levelup.png" });
        embed.setImage("attachment://levelup.png");
        return interaction.editReply({ embeds: [embed], files: [file] });
      } catch {}
    }

    return interaction.editReply({ embeds: [embed] });
  }

  // ── Work ─────────────────────────────────────────────────────────────────────
  if (sub === "work") {
    await interaction.deferReply();
    const eco  = await getEconomy(userId, guildId);
    const now  = Date.now();
    const lastWork = Number(eco.last_work || 0);

    if (now - lastWork < WORK_CD) {
      const remaining = Math.ceil((WORK_CD - (now - lastWork)) / 3600000 * 10) / 10;
      return interaction.editReply({ content: `⏳ You need to rest after your shift! Back in **${remaining}h**.` });
    }

    const JOBS = [
      "Set up stage props before the show",
      "Handled ticket sales at the Zubayr Theater entrance",
      "Helped the costume department backstage",
      "Delivered refreshments to performers",
      "Swept the Grand Bazaar stage after the evening show",
      "Assisted the lighting crew during rehearsal",
    ];
    const job   = JOBS[Math.floor(Math.random() * JOBS.length)];
    const coins = rand(30, 100);
    const exp   = rand(5, 20);
    const oldExp  = Number(eco.exp);
    const newExp  = oldExp + exp;
    const newLevel = getLevelFromExp(newExp);

    await updateEconomy(userId, guildId, {
      coins:     Number(eco.coins) + coins,
      exp:       newExp,
      level:     newLevel,
      rank:      getRank(newLevel),
      last_work: now,
    });

    const embed = new EmbedBuilder().setColor(0x4a90d9)
      .setTitle("✦ Work Shift Complete!")
      .setDescription(
        `${DIVIDER}\n📋 **${job}**\n\n` +
        `💠 **+${coins}** Coins\n` +
        `⭐ **+${exp}** EXP\n\n` +
        `Balance: **${fmt(Number(eco.coins) + coins)}** 💠\n${DIVIDER}`
      )
      .setFooter(FOOTER_MAIN).setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }

  // ── Profile ──────────────────────────────────────────────────────────────────
  if (sub === "profile") {
    const target = interaction.options.getUser("user") || interaction.user;
    await interaction.deferReply();
    const eco  = await getEconomy(target.id, guildId);
    const lv   = getLevelFromExp(Number(eco.exp));
    const next = getExpForLevel(lv);
    const progress = next > 0 ? Math.min(100, Math.round((Number(eco.exp) / next) * 100)) : 100;
    const bar  = "█".repeat(Math.floor(progress / 5)) + "░".repeat(20 - Math.floor(progress / 5));
    const inv  = JSON.parse(eco.inventory || "[]");

    const embed = new EmbedBuilder().setColor(NILOU_RED)
      .setTitle(`✦ ${target.username}'s Theater Profile`)
      .setThumbnail(target.displayAvatarURL({ dynamic: true }))
      .setDescription(`${DIVIDER}\n🎭 **${getRank(lv)}** · Level **${lv}**\n${DIVIDER}`)
      .addFields(
        { name: "💠 Coins",            value: fmt(eco.coins),            inline: true },
        { name: "🎟️ Theater Credits", value: fmt(eco.theater_credits),   inline: true },
        { name: "🎭 Fame",             value: fmt(eco.fame),              inline: true },
        { name: "⭐ EXP",              value: `${fmt(eco.exp)} / ${fmt(next)}\n\`${bar}\` ${progress}%`, inline: false },
        { name: "🔥 Daily Streak",     value: `**${eco.daily_streak || 0}** days`, inline: true },
        { name: "🎒 Inventory",        value: inv.length > 0 ? inv.slice(0, 5).map(i => SHOP_ITEMS.find(s => s.id === i)?.name || i).join("\n") + (inv.length > 5 ? `\n*(+${inv.length - 5} more)*` : "") : "Empty", inline: false },
      )
      .setFooter(FOOTER_MAIN).setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }

  // ── Shop ─────────────────────────────────────────────────────────────────────
  if (sub === "shop") {
    const embed = new EmbedBuilder().setColor(NILOU_RED)
      .setTitle("✦ Menakeri's Treasure Shop 🛍️")
      .setDescription(`${DIVIDER}\n🌸 Browse and use \`/economy buy <item>\` to purchase!\n${DIVIDER}`)
      .addFields(SHOP_ITEMS.map(item => ({
        name:  `${item.name}`,
        value: `💠 ${fmt(item.price)} Coins / 🎟️ ${fmt(item.tcPrice)} TC · ID: \`${item.id}\`\n${item.desc}${item.consumable ? " *(consumable)*" : ""}`,
        inline: false,
      })))
      .setFooter(FOOTER_MAIN).setTimestamp();
    return interaction.reply({ embeds: [embed] });
  }

  // ── Buy ──────────────────────────────────────────────────────────────────────
  if (sub === "buy") {
    const itemId   = interaction.options.getString("item");
    const currency = interaction.options.getString("currency") || "coins";
    const item     = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return interaction.reply({ content: "❌ Item not found.", ephemeral: true });

    await interaction.deferReply({ ephemeral: true });
    const eco     = await getEconomy(userId, guildId);
    const price   = currency === "theater_credits" ? item.tcPrice : item.price;
    const balance = Number(eco[currency]);

    if (balance < price) return interaction.editReply({ content: `❌ Need ${fmt(price)} ${currency === "theater_credits" ? "🎟️" : "💠"} — you only have ${fmt(balance)}.` });

    const inventory = JSON.parse(eco.inventory || "[]");
    inventory.push(itemId);
    await updateEconomy(userId, guildId, { [currency]: balance - price, inventory: JSON.stringify(inventory) });

    return interaction.editReply({ content: `🌸 You bought **${item.name}**! ${item.desc}` });
  }

  // ── Inventory ────────────────────────────────────────────────────────────────
  if (sub === "inventory") {
    const target = interaction.options.getUser("user") || interaction.user;
    const eco    = await getEconomy(target.id, guildId);
    const inv    = JSON.parse(eco.inventory || "[]");

    // Group items
    const counts = {};
    for (const id of inv) counts[id] = (counts[id] || 0) + 1;

    const embed = new EmbedBuilder().setColor(NILOU_RED)
      .setTitle(`✦ ${target.username}'s Inventory`)
      .setDescription(
        Object.keys(counts).length === 0
          ? `${DIVIDER}\n🌸 No items yet! Visit \`/economy shop\`.\n${DIVIDER}`
          : `${DIVIDER}\n${Object.entries(counts).map(([id, qty]) => {
              const it = SHOP_ITEMS.find(s => s.id === id);
              return it ? `${it.name}${qty > 1 ? ` ×${qty}` : ""} — ${it.desc}` : `Unknown: ${id}`;
            }).join("\n")}\n${DIVIDER}`
      )
      .setFooter(FOOTER_MAIN).setTimestamp();
    return interaction.reply({ embeds: [embed] });
  }

  // ── Transfer ─────────────────────────────────────────────────────────────────
  if (sub === "transfer") {
    const target = interaction.options.getUser("user");
    const amount = interaction.options.getInteger("amount");

    if (target.id === userId) return interaction.reply({ content: "❌ You can't send coins to yourself.", ephemeral: true });
    if (target.bot)           return interaction.reply({ content: "❌ You can't send coins to a bot.", ephemeral: true });

    await interaction.deferReply();
    const eco = await getEconomy(userId, guildId);
    if (Number(eco.coins) < amount) return interaction.editReply({ content: `❌ You only have **${fmt(eco.coins)}** 💠.` });

    const targetEco = await getEconomy(target.id, guildId);
    await updateEconomy(userId,    guildId, { coins: Number(eco.coins)       - amount });
    await updateEconomy(target.id, guildId, { coins: Number(targetEco.coins) + amount });

    const embed = new EmbedBuilder().setColor(NILOU_RED)
      .setTitle("✦ Coins Transferred 💠")
      .setDescription(
        `${DIVIDER}\n` +
        `💠 **${fmt(amount)}** coins sent to ${target}!\n\n` +
        `Your balance: **${fmt(Number(eco.coins) - amount)}** 💠\n` +
        `${DIVIDER}`
      )
      .setFooter(FOOTER_MAIN).setTimestamp();
    return interaction.editReply({ embeds: [embed] });
  }

  // ── Leaderboard ──────────────────────────────────────────────────────────────
  if (sub === "leaderboard") {
    const type  = interaction.options.getString("type") || "coins";
    const rows  = await getLeaderboard(guildId, type, 10);
    const label = { coins: "💠 Coins", theater_credits: "🎟️ Theater Credits", fame: "🎭 Fame", exp: "⭐ EXP" }[type];
    const medals = ["🥇","🥈","🥉"];

    const embed = new EmbedBuilder().setColor(NILOU_RED)
      .setTitle(`✦ Theater Leaderboard — ${label}`)
      .setDescription(
        rows.length === 0
          ? "No data yet — start performing!"
          : rows.map((r, i) =>
              `${medals[i] || `**${i+1}.**`} <@${r.user_id}> — **${fmt(r[type])}** ${label.split(" ")[0]}`
            ).join("\n")
      )
      .setFooter(FOOTER_MAIN).setTimestamp();
    return interaction.reply({ embeds: [embed] });
  }
}
