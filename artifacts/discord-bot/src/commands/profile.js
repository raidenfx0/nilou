import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getUid } from "../db/uidStore.js";
import { fetchProfile, parsePlayerInfo, parseCharacters } from "../utils/enka.js";
import { rateCV } from "../utils/genshinData.js";
import { NILOU_RED, FOOTER_GENSHIN, DIVIDER } from "../theme.js";

/**
 * CHARACTER NAME FIXER
 */
const CHAR_NAMES = {
  "10000002": "Kamisato Ayaka",
  "10000003": "Jean",
  "10000005": "Aether",
  "10000007": "Lumine",
  "10000006": "Lisa",
  "10000008": "Venti",
  "10000011": "Diluc",
  "10000012": "Kaeya",
  "10000014": "Barbara",
  "10000015": "Xiangling",
  "10000016": "Bennett",
  "10000017": "Razor",
  "10000018": "Amber",
  "10000019": "Mona",
  "10000020": "Fischl",
  "10000021": "Klee",
  "10000022": "Beidou",
  "10000023": "Ningguang",
  "10000024": "Xingqiu",
  "10000025": "Xiao",
  "10000026": "Chongyun",
  "10000027": "Noelle",
  "10000029": "Qiqi",
  "10000030": "Zhongli",
  "10000031": "Keqing",
  "10000032": "Sucrose",
  "10000033": "Tartaglia",
  "10000034": "Xinyan",
  "10000035": "Albedo",
  "10000036": "Diona",
  "10000037": "Ganyu",
  "10000039": "Hu Tao",
  "10000041": "Rosaria",
  "10000042": "Eula",
  "10000043": "Yanfei",
  "10000044": "Kazuha",
  "10000045": "Ayato",
  "10000046": "Sayu",
  "10000047": "Yoimiya",
  "10000048": "Raiden Shogun",
  "10000049": "Kujou Sara",
  "10000050": "Itto",
  "10000051": "Gorou",
  "10000052": "Shenhe",
  "10000053": "Yae Miko",
  "10000054": "Yun Jin",
  "10000055": "Kuki Shinobu",
  "10000056": "Heizou",
  "10000057": "Yelan",
  "10000058": "Tighnari",
  "10000059": "Collei",
  "10000060": "Dori",
  "10000061": "Nahida",
  "10000062": "Layla",
  "10000063": "Wanderer",
  "10000064": "Faruzan",
  "10000065": "Yaoyao",
  "10000066": "Alhaitham",
  "10000067": "Dehya",
  "10000068": "Mika",
  "10000069": "Kaveh",
  "10000070": "Baizhu",
  "10000071": "Kirara",
  "10000072": "Lyney",
  "10000073": "Lynette",
  "10000074": "Freminet",
  "10000075": "Neuvillette",
  "10000076": "Wriothesley",
  "10000077": "Furina",
  "10000078": "Charlotte",
  "10000079": "Navia",
  "10000080": "Chevreuse",
  "10000081": "Gaming",
  "10000082": "Xianyun",
  "10000083": "Chiori"
};

export const data = new SlashCommandBuilder()
  .setName("profile")
  .setDescription("View your Genshin profile & Akasha rankings.")
  .addUserOption(o =>
    o.setName("user")
      .setDescription("View another user's profile (they must have registered their UID)")
      .setRequired(false)
  );

export async function execute(interaction) {
  await interaction.deferReply();

  const target = interaction.options.getUser("user") || interaction.user;
  const uid = getUid(target.id);

  if (!uid) {
    return interaction.editReply({
      content: target.id === interaction.user.id
        ? "❌ You haven't registered your UID yet. Use **/register** first!"
        : `❌ ${target.username} hasn't registered a UID yet.`,
    });
  }

  let profileData;
  try {
    profileData = await fetchProfile(uid);
    if (!profileData) throw new Error("Could not find data for this UID.");
  } catch (err) {
    return interaction.editReply({ content: `❌ ${err.message}` });
  }

  const p = parsePlayerInfo(profileData);
  const characters = parseCharacters(profileData);

  let leadCharacterIcon = p.avatarIcon;

  const showcaseList = characters.length > 0
    ? characters.map((c, i) => {
        if (i === 0) leadCharacterIcon = c.icon;

        const finalName = CHAR_NAMES[c.id] || c.name || "Unknown Character";
        const isTopTier = c.akashaRank <= 1;
        const rankEmoji = isTopTier ? "👑 " : "⭐ ";
        const rankText = c.akashaRank ? ` | Top **${c.akashaRank}%**` : "";

        return `${i + 1}. ${rankEmoji}**${finalName}** · Lv.${c.level}${rankText}\n  └ CV ${c.totalCV} (${rateCV(c.totalCV)})`;
      }).join("\n")
    : p.showcaseIds.length > 0
    ? `${p.showcaseIds.length} characters (set profile to public for details)`
    : "No characters in showcase.";

  const embed = new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle(`✦ ${p.nickname}'s Akasha Profile`)
    .setURL(`https://akasha.cv/profile/${uid}`)
    .setThumbnail(`https://enka.network/ui/${leadCharacterIcon}.png`)
    .setDescription(`${DIVIDER}\n🌸 UID: \`${p.uid}\`\n🔗 [Open Akasha Leaderboards](https://akasha.cv/profile/${uid})\n${DIVIDER}`)
    .addFields(
      {
        name: "🗺️ Explorer Info",
        value:
          `AR: **${p.ar}** (WL${p.worldLevel})\n` +
          `Achievements: **${p.achievements?.toLocaleString() || 0}**\n` +
          (p.signature ? `Signature: *${p.signature}*` : ""),
        inline: true,
      },
      {
        name: "🌀 Battle Record",
        value: 
          `Abyss: **${p.abyssFloor > 0 ? `${p.abyssFloor}-${p.abyssLevel}` : "No data"}**\n` +
          `Theater: **${p.theaterFloor > 0 ? `Act ${p.theaterFloor}` : "No data"}**`,
        inline: true,
      },
      {
        name: "🏆 Showcase Rankings",
        value: showcaseList,
        inline: false,
      }
    )
    .addFields({ 
        name: "🕒 Last Sync", 
        value: p.updatedAt ? `<t:${Math.floor(p.updatedAt / 1000)}:R>` : "Recently", 
        inline: false 
    })
    .setFooter({ text: "Wrong names? Update character IDs in profile.js!" })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}