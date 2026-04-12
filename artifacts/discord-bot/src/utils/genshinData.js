export const CHARACTER_NAMES = {
  10000002: "Kamisato Ayaka", 10000003: "Qiqi", 10000006: "Lisa",
  10000007: "Traveler", 10000014: "Barbara", 10000015: "Kaeya",
  10000016: "Diluc", 10000020: "Razor", 10000021: "Amber",
  10000022: "Venti", 10000023: "Xiangling", 10000024: "Beidou",
  10000025: "Xingqiu", 10000026: "Xiao", 10000027: "Ningguang",
  10000029: "Klee", 10000030: "Zhongli", 10000031: "Fischl",
  10000032: "Bennett", 10000033: "Tartaglia", 10000034: "Noelle",
  10000036: "Chongyun", 10000037: "Ganyu", 10000038: "Albedo",
  10000039: "Diona", 10000041: "Mona", 10000042: "Keqing",
  10000043: "Sucrose", 10000044: "Xinyan", 10000045: "Rosaria",
  10000046: "Hu Tao", 10000047: "Kaedehara Kazuha", 10000048: "Yanfei",
  10000049: "Yoimiya", 10000050: "Thoma", 10000051: "Eula",
  10000052: "Raiden Shogun", 10000053: "Sayu", 10000054: "Sangonomiya Kokomi",
  10000055: "Gorou", 10000056: "Kujou Sara", 10000057: "Arataki Itto",
  10000058: "Yae Miko", 10000059: "Shikanoin Heizou", 10000060: "Yelan",
  10000061: "Aloy", 10000062: "Shenhe", 10000063: "Yun Jin",
  10000064: "Kuki Shinobu", 10000065: "Kamisato Ayato", 10000066: "Collei",
  10000067: "Dori", 10000068: "Tighnari", 10000069: "Nilou",
  10000070: "Cyno", 10000071: "Candace", 10000072: "Nahida",
  10000073: "Layla", 10000074: "Wanderer", 10000075: "Faruzan",
  10000076: "Yaoyao", 10000077: "Alhaitham", 10000078: "Dehya",
  10000079: "Mika", 10000080: "Kaveh", 10000081: "Baizhu",
  10000082: "Lynette", 10000083: "Lyney", 10000084: "Freminet",
  10000085: "Wriothesley", 10000086: "Neuvillette", 10000087: "Charlotte",
  10000088: "Furina", 10000089: "Chevreuse", 10000090: "Navia",
  10000091: "Gaming", 10000092: "Xianyun", 10000093: "Chiori",
  10000094: "Sigewinne", 10000095: "Arlecchino", 10000096: "Sethos",
  10000097: "Clorinde", 10000098: "Emilie", 10000099: "Kachina",
  10000100: "Kinich", 10000101: "Mualani", 10000102: "Xilonen",
  10000103: "Chasca", 10000104: "Ororon", 10000105: "Citlali",
  10000106: "Lan Yan", 10000107: "Mavuika",
};

export const EQUIP_TYPE_NAMES = {
  EQUIP_BRACER:  "🌸 Flower",
  EQUIP_NECKLACE:"🪶 Feather",
  EQUIP_SHOES:   "⏳ Sands",
  EQUIP_RING:    "🏆 Goblet",
  EQUIP_DRESS:   "👑 Circlet",
};

export const STAT_NAMES = {
  FIGHT_PROP_HP:                   "HP",
  FIGHT_PROP_HP_PERCENT:           "HP%",
  FIGHT_PROP_ATTACK:               "ATK",
  FIGHT_PROP_ATTACK_PERCENT:       "ATK%",
  FIGHT_PROP_DEFENSE:              "DEF",
  FIGHT_PROP_DEFENSE_PERCENT:      "DEF%",
  FIGHT_PROP_ELEMENT_MASTERY:      "EM",
  FIGHT_PROP_CRITICAL:             "CRIT Rate",
  FIGHT_PROP_CRITICAL_HURT:        "CRIT DMG",
  FIGHT_PROP_CHARGE_EFFICIENCY:    "Energy Recharge",
  FIGHT_PROP_HEAL_ADD:             "Healing Bonus",
  FIGHT_PROP_FIRE_ADD_HURT:        "Pyro DMG%",
  FIGHT_PROP_WATER_ADD_HURT:       "Hydro DMG%",
  FIGHT_PROP_WIND_ADD_HURT:        "Anemo DMG%",
  FIGHT_PROP_ELEC_ADD_HURT:        "Electro DMG%",
  FIGHT_PROP_ICE_ADD_HURT:         "Cryo DMG%",
  FIGHT_PROP_ROCK_ADD_HURT:        "Geo DMG%",
  FIGHT_PROP_GRASS_ADD_HURT:       "Dendro DMG%",
  FIGHT_PROP_PHYSICAL_ADD_HURT:    "Physical DMG%",
};

export const FIGHT_PROP_KEYS = {
  1:    "Base HP",
  4:    "Base ATK",
  7:    "Base DEF",
  28:   "Elemental Mastery",
  23:   "Energy Recharge",
  20:   "CRIT Rate",
  22:   "CRIT DMG",
  26:   "Healing Bonus",
  2001: "CRIT Rate",
  2002: "CRIT DMG",
  2000: "HP",
  2001: "ATK",
};

export function getCharacterName(avatarId) {
  return CHARACTER_NAMES[avatarId] || `Character #${avatarId}`;
}

export function calcCV(reliquary) {
  if (!reliquary?.flat) return 0;
  let cr = 0, cd = 0;
  for (const sub of (reliquary.flat.reliquarySubstats || [])) {
    if (sub.appendPropId === "FIGHT_PROP_CRITICAL")      cr += sub.statValue;
    if (sub.appendPropId === "FIGHT_PROP_CRITICAL_HURT") cd += sub.statValue;
  }

  const main = reliquary.flat.reliquaryMainstat;
  if (main?.mainPropId === "FIGHT_PROP_CRITICAL") {
    cr += main.statValue;
  }
  if (main?.mainPropId === "FIGHT_PROP_CRITICAL_HURT") {
    cd += main.statValue;
  }

  return parseFloat(((cr * 2) + cd).toFixed(1));
}

export function rateCV(cv) {
  if (cv >= 220) return "🔱 Godly";
  if (cv >= 180) return "💎 Legendary";
  if (cv >= 140) return "⭐ Great";
  if (cv >= 100) return "✅ Good";
  return "🌱 Fledgling";
}

export function formatStat(key, value) {
  const pct = ["FIGHT_PROP_HP_PERCENT","FIGHT_PROP_ATTACK_PERCENT","FIGHT_PROP_DEFENSE_PERCENT",
    "FIGHT_PROP_CRITICAL","FIGHT_PROP_CRITICAL_HURT","FIGHT_PROP_CHARGE_EFFICIENCY",
    "FIGHT_PROP_HEAL_ADD","FIGHT_PROP_FIRE_ADD_HURT","FIGHT_PROP_WATER_ADD_HURT",
    "FIGHT_PROP_WIND_ADD_HURT","FIGHT_PROP_ELEC_ADD_HURT","FIGHT_PROP_ICE_ADD_HURT",
    "FIGHT_PROP_ROCK_ADD_HURT","FIGHT_PROP_GRASS_ADD_HURT","FIGHT_PROP_PHYSICAL_ADD_HURT"];
  const name = STAT_NAMES[key] || key;
  const formatted = pct.includes(key) ? `${value.toFixed(1)}%` : Math.round(value).toLocaleString();
  return `${name}: ${formatted}`;
}

export const ENKA_CDN = "https://enka.network/ui";
