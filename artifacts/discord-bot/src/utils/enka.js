import { getCharacterName, calcCV, EQUIP_TYPE_NAMES, FIGHT_PROP_KEYS } from "./genshinData.js";

const BASE_URL = "https://enka.network/api/uid";
const HEADERS  = { "User-Agent": "NilouBot/1.0 (Discord Bot)" };

export async function fetchProfile(uid) {
  const res = await fetch(`${BASE_URL}/${uid}`, { headers: HEADERS });

  if (res.status === 400) throw new Error("Invalid UID format.");
  if (res.status === 404) throw new Error("UID not found. Make sure your profile is public in Genshin Impact.");
  if (res.status === 429) throw new Error("Too many requests. Please try again in a moment.");
  if (res.status === 500) throw new Error("Enka.Network server error. Try again later.");
  if (!res.ok)            throw new Error(`Enka.Network returned status ${res.status}.`);

  const data = await res.json();
  return data;
}

export function parsePlayerInfo(data) {
  const p = data.playerInfo;
  return {
    uid:            data.uid || "Unknown",
    nickname:       p.nickname || "Unknown",
    ar:             p.level || 0,
    worldLevel:     p.worldLevel || 0,
    signature:      p.signature || "",
    achievements:   p.finishAchievementNum || 0,
    abyssFloor:     p.towerFloorIndex || 0,
    abyssLevel:     p.towerLevelIndex || 0,
    theaterFloor:   p.theaterFloorIndex || 0,
    theaterStars:   p.theaterStarCount || 0,
    showcaseIds:    (p.showAvatarInfoList || []).map(a => a.avatarId),
  };
}

export function parseCharacters(data) {
  if (!data.avatarInfoList) return [];
  return data.avatarInfoList.map(avatar => {
    const level   = avatar.propMap?.["4001"]?.val || "?";
    const fightProp = avatar.fightPropMap || {};
    const name    = getCharacterName(avatar.avatarId);

    const artifacts = (avatar.equipList || [])
      .filter(e => e.flat?.itemType === "ITEM_RELIQUARY")
      .map(e => {
        const cv        = calcCV(e);
        const equipType = e.flat?.equipType || "";
        const mainStat  = e.flat?.reliquaryMainstat;
        const subStats  = e.flat?.reliquarySubstats || [];
        const setName   = e.flat?.setNameTextMapHash || "";
        const icon      = e.flat?.icon || "";

        return {
          type:     EQUIP_TYPE_NAMES[equipType] || equipType,
          equipType,
          icon,
          cv,
          mainStat: mainStat
            ? { key: mainStat.mainPropId, value: mainStat.statValue }
            : null,
          subStats: subStats.map(s => ({ key: s.appendPropId, value: s.statValue })),
          characterName: name,
          level: parseInt(e.reliquary?.level || 0) - 1,
        };
      });

    const totalCV = artifacts.reduce((sum, a) => sum + a.cv, 0);

    const weapon = (avatar.equipList || []).find(e => e.weapon);
    const weaponIcon = weapon?.flat?.icon || "";
    const weaponName = weapon?.flat?.nameTextMapHash || "";

    return {
      avatarId:   avatar.avatarId,
      name,
      level:      parseInt(level),
      icon:       `UI_AvatarIcon_${avatar.avatarId}`,
      hp:         fightProp[2000] || fightProp[1] || 0,
      atk:        fightProp[2001] || fightProp[4] || 0,
      def:        fightProp[2002] || fightProp[7] || 0,
      em:         fightProp[28]  || 0,
      er:         ((fightProp[23] || 1) * 100).toFixed(1),
      critRate:   (fightProp[20] || 0).toFixed(1),
      critDmg:    (fightProp[22] || 0).toFixed(1),
      totalCV:    parseFloat(totalCV.toFixed(1)),
      artifacts,
      weaponIcon,
    };
  });
}
