import { fetchProfile, parseCharacters } from "../src/utils/enka.js";

const uid = process.argv[2] || "890577315";
const match = (process.argv[3] || "Arlecchino").toLowerCase();

const raw = await fetchProfile(uid);
const parsed = await parseCharacters(raw);
const char = parsed.find((c) => c.name.toLowerCase().includes(match));

if (!char) {
  console.log(`Character not found for: ${match}`);
  console.log("Available:", parsed.map((c) => c.name).join(", "));
  process.exit(1);
}

const rawAvatar = (raw.avatarInfoList || []).find((a) => a.avatarId === char.avatarId);
const fp = rawAvatar?.fightPropMap || {};

let fromArtifacts = 0;
let sumCr = 0;
let sumCd = 0;

console.log(`UID: ${uid}`);
console.log(`Character: ${char.name} (avatarId=${char.avatarId})`);
console.log("\nArtifact CV pieces (with main stat if crit):");

for (const art of char.artifacts) {
  const cr = (art.subStats.find((s) => s.key === "FIGHT_PROP_CRITICAL")?.value) || 0;
  const cd = (art.subStats.find((s) => s.key === "FIGHT_PROP_CRITICAL_HURT")?.value) || 0;
  const cv = art.cv;
  sumCr += cr;
  sumCd += cd;
  fromArtifacts += cv;
  console.log(`${art.type}: subCR=${cr} subCD=${cd} -> CV=${cv.toFixed(1)}`);
}

const totalStatsCvRaw = ((fp[20] || 0) * 2) + (fp[22] || 0);
const totalStatsCvPct = (((fp[20] || 0) * 100) * 2) + ((fp[22] || 0) * 100);

console.log("\nComputed:");
console.log(`From artifacts (with crit mainstat): ${fromArtifacts.toFixed(1)} (subCR=${sumCr.toFixed(1)}, subCD=${sumCd.toFixed(1)})`);
console.log(`Parser totalCV: ${char.totalCV}`);
console.log(`From fightProp raw (2*fp20 + fp22): ${totalStatsCvRaw.toFixed(3)}`);
console.log(`From fightProp as % ((2*CR)+CD): ${totalStatsCvPct.toFixed(1)}`);
console.log(`fightProp20=${fp[20]} fightProp22=${fp[22]}`);
