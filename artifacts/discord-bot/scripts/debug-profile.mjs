import { fetchProfile, parseCharacters } from "../src/utils/enka.js";

const uid = process.argv[2] || "890577315";

const raw = await fetchProfile(uid);
const chars = await parseCharacters(raw);

console.log(`UID: ${uid}`);
console.log(`avatarInfoList: ${Array.isArray(raw.avatarInfoList) ? raw.avatarInfoList.length : 0}`);
console.log(`showAvatarInfoList: ${Array.isArray(raw?.playerInfo?.showAvatarInfoList) ? raw.playerInfo.showAvatarInfoList.length : 0}`);

if (!Array.isArray(raw.avatarInfoList) || raw.avatarInfoList.length === 0) {
  console.log("No avatarInfoList data.");
  process.exit(0);
}

console.log("\nRaw avatar IDs from Enka:");
for (let i = 0; i < raw.avatarInfoList.length; i += 1) {
  const a = raw.avatarInfoList[i];
  const lv = a?.propMap?.["4001"]?.val ?? "?";
  const artCount = Array.isArray(a.equipList)
    ? a.equipList.filter((e) => e?.flat?.itemType === "ITEM_RELIQUARY").length
    : 0;
  console.log(`${i + 1}. avatarId=${a.avatarId} lv=${lv} artifacts=${artCount}`);
}

console.log("\nParsed names + CV:");
for (let i = 0; i < chars.length; i += 1) {
  const c = chars[i];
  console.log(`${i + 1}. ${c.name} (avatarId=${c.avatarId}) | Lv.${c.level} | CV ${c.totalCV}`);
}
