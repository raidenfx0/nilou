import { createCanvas, loadImage } from "@napi-rs/canvas";
import { EQUIP_TYPE_NAMES, STAT_NAMES, ENKA_CDN } from "./genshinData.js";

const NILOU_RED  = "#E84057";
const CARD_BG    = "#0d0509";
const PANEL_BG   = "#1a0a10";
const TEXT_MAIN  = "#fff8f0";
const TEXT_MUTED = "#b08090";

async function tryLoadImage(url) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "NilouBot/1.0" } });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return await loadImage(buf);
  } catch { return null; }
}

function weaponStatFmt(stat) {
  const key = stat.key;
  const name = STAT_NAMES[key] || key;
  const pctKeys = ["FIGHT_PROP_HP_PERCENT","FIGHT_PROP_ATTACK_PERCENT","FIGHT_PROP_DEFENSE_PERCENT","FIGHT_PROP_CRITICAL","FIGHT_PROP_CRITICAL_HURT","FIGHT_PROP_CHARGE_EFFICIENCY","FIGHT_PROP_HEAL_ADD","FIGHT_PROP_FIRE_ADD_HURT","FIGHT_PROP_WATER_ADD_HURT","FIGHT_PROP_WIND_ADD_HURT","FIGHT_PROP_ELEC_ADD_HURT","FIGHT_PROP_ICE_ADD_HURT","FIGHT_PROP_ROCK_ADD_HURT","FIGHT_PROP_GRASS_ADD_HURT","FIGHT_PROP_PHYSICAL_ADD_HURT"];
  const val = pctKeys.includes(key) || key.includes("PERCENT") || key.includes("CRITICAL") || key.includes("HURT") || key.includes("EFFICIENCY") || key.includes("ADD_HURT")
    ? `${stat.value.toFixed(1)}%`
    : Math.round(stat.value);
  return `${name}: ${val}`;
}

export async function generateBuildCard(character, playerInfo, hideDetails = false) {
  const W = 860, H = 560;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext("2d");

  // Background
  ctx.fillStyle = CARD_BG;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = PANEL_BG;
  roundRect(ctx, 10, 10, W - 20, H - 20, 16);
  ctx.fill();

  const leftW = 240;

  // ── Left panel background ──
  ctx.fillStyle = "#120608";
  roundRect(ctx, 10, 10, leftW, H - 20, 16);
  ctx.fill();

  // ── Character image ──
  // Gacha splash: use icon internal name (consistent with Enka CDN naming)
  const internalName = character.icon.replace("UI_AvatarIcon_", "");
  const urls = [
    `https://enka.network/ui/UI_Gacha_AvatarImg_${internalName}.png`,
    `https://api.ambr.top/assets/UI/UI_Gacha_AvatarImg_${internalName}.png`,
    `https://enka.network/ui/${character.icon}.png`,
    `https://api.ambr.top/assets/UI/${character.icon}.png`,
  ];

  let charImg = null;
  for (const url of urls) {
    charImg = await tryLoadImage(url);
    if (charImg) break;
  }

  const imgBoxW = leftW - 20;
  const imgBoxH = 260;
  const imgX = 20, imgY = 20;

  if (charImg) {
    ctx.save();
    roundRect(ctx, imgX, imgY, imgBoxW, imgBoxH, 12);
    ctx.clip();
    // Center-crop cover style
    const scale = Math.max(imgBoxW / charImg.width, imgBoxH / charImg.height);
    const dw = charImg.width * scale;
    const dh = charImg.height * scale;
    const dx = imgX + (imgBoxW - dw) / 2;
    const dy = imgY + (imgBoxH - dh) / 2;
    ctx.drawImage(charImg, dx, dy, dw, dh);
    ctx.restore();

    // Dark gradient overlay at bottom of image for text readability
    const grad = ctx.createLinearGradient(imgX, imgY + imgBoxH - 60, imgX, imgY + imgBoxH);
    grad.addColorStop(0, "rgba(18,6,8,0)");
    grad.addColorStop(1, "rgba(18,6,8,0.85)");
    ctx.fillStyle = grad;
    ctx.fillRect(imgX, imgY + imgBoxH - 60, imgBoxW, 60);
  } else {
    ctx.fillStyle = "#2a0f18";
    roundRect(ctx, imgX, imgY, imgBoxW, imgBoxH, 12);
    ctx.fill();
    ctx.fillStyle = NILOU_RED;
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(character.name, leftW / 2 + 10, imgY + imgBoxH / 2);
  }

  // ── Name + Constellation overlay on image ──
  ctx.fillStyle = TEXT_MAIN;
  ctx.font = "bold 20px sans-serif";
  ctx.textAlign = "center";
  const nameY = charImg ? imgY + imgBoxH - 48 : imgY + imgBoxH - 48;
  ctx.fillText(character.name, leftW / 2 + 10, nameY);

  const c = Math.min(character.constellations || 0, 6);
  const starStr = "\u2605".repeat(c) + "\u2606".repeat(6 - c);
  ctx.fillStyle = c >= 6 ? "#ff5e5e" : c >= 4 ? "#ffcc00" : c >= 2 ? "#b266ff" : "#a08090";
  ctx.font = "bold 14px sans-serif";
  ctx.fillText(`C${c} ${starStr}`, leftW / 2 + 10, nameY + 22);

  // ── Divider ──
  ctx.fillStyle = NILOU_RED;
  ctx.fillRect(10, 288, leftW, 2);

  // ── Level + Total CV ──
  ctx.fillStyle = TEXT_MUTED;
  ctx.font = "13px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`Lv.${character.level} \u00b7 Total CV ${character.totalCV}`, leftW / 2 + 10, 308);

  // ── Stats ──
  const stats = [
    ["HP",    Math.round(character.hp).toLocaleString()],
    ["ATK",   Math.round(character.atk).toLocaleString()],
    ["DEF",   Math.round(character.def).toLocaleString()],
    ["EM",    Math.round(character.em)],
    ["ER",    `${character.er}%`],
    ["CR",    `${character.critRate}%`],
    ["CD",    `${character.critDmg}%`],
  ];
  if (character.elementBonus > 0 && character.elementName) {
    stats.push([`${character.elementName} DMG`, `${character.elementBonus}%`]);
  }

  let sy = 332;
  for (const [label, val] of stats) {
    ctx.textAlign = "left";
    ctx.fillStyle = TEXT_MUTED;
    ctx.font = "11px sans-serif";
    ctx.fillText(label, 20, sy);
    ctx.textAlign = "right";
    ctx.fillStyle = TEXT_MAIN;
    ctx.font = "11px sans-serif";
    ctx.fillText(String(val), leftW - 5, sy);
    sy += 18;
  }

  // ── Weapon panel ──
  const wy = H - 70;
  if (character.weapon) {
    const w = character.weapon;
    ctx.fillStyle = "#1f0a12";
    roundRect(ctx, 16, wy, leftW - 12, 52, 8);
    ctx.fill();

    // Weapon icon
    if (w.icon) {
      const wImg = await tryLoadImage(`${ENKA_CDN}/${w.icon}.png`);
      if (wImg) {
        ctx.save();
        roundRect(ctx, 22, wy + 6, 40, 40, 6);
        ctx.clip();
        ctx.drawImage(wImg, 22, wy + 6, 40, 40);
        ctx.restore();
      }
    }

    // Weapon name
    const wName = w.name || "Weapon";
    ctx.fillStyle = TEXT_MAIN;
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(wName, 68, wy + 20);

    // Refinement + Level
    const stars = "\u2605".repeat(w.rankLevel || 1);
    ctx.fillStyle = TEXT_MUTED;
    ctx.font = "10px sans-serif";
    ctx.fillText(`R${w.refinement} ${stars} \u00b7 Lv.${w.level}`, 68, wy + 36);

    // Weapon substat (skip BASE_ATTACK)
    if (w.stats && w.stats.length > 0) {
      const subStat = w.stats.find(s => s.key !== "FIGHT_PROP_BASE_ATTACK") || w.stats[0];
      const statLine = weaponStatFmt(subStat);
      ctx.textAlign = "right";
      ctx.fillStyle = TEXT_MUTED;
      ctx.font = "10px sans-serif";
      ctx.fillText(statLine, leftW - 10, wy + 28);
    }
  } else {
    ctx.fillStyle = TEXT_MUTED;
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("No weapon data", leftW / 2 + 10, wy + 28);
  }

  // ── Artifacts grid ──
  const artX = leftW + 30;
  const artW = (W - artX - 20) / 3;
  const artifactTypes = ["EQUIP_BRACER","EQUIP_NECKLACE","EQUIP_SHOES","EQUIP_RING","EQUIP_DRESS"];

  for (let i = 0; i < Math.min(5, artifactTypes.length); i++) {
    const art = character.artifacts.find(a => a.equipType === artifactTypes[i]);
    const col = i % 3;
    const row = Math.floor(i / 3);
    const ax = artX + col * (artW + 8);
    const ay = 20 + row * 265;
    const aw = artW;
    const ah = 250;

    ctx.fillStyle = "#200c12";
    roundRect(ctx, ax, ay, aw, ah, 10);
    ctx.fill();

    ctx.strokeStyle = NILOU_RED + "44";
    ctx.lineWidth = 1;
    roundRect(ctx, ax, ay, aw, ah, 10);
    ctx.stroke();

    const typeName = EQUIP_TYPE_NAMES[artifactTypes[i]] || artifactTypes[i];
    ctx.fillStyle = NILOU_RED;
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(typeName, ax + 8, ay + 18);

    if (!art) {
      ctx.fillStyle = TEXT_MUTED;
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No artifact", ax + aw / 2, ay + ah / 2);
      continue;
    }

    // Artifact icon
    if (art.icon) {
      const iconImg = await tryLoadImage(`${ENKA_CDN}/${art.icon}.png`);
      if (iconImg) {
        ctx.save();
        roundRect(ctx, ax + 6, ay + 24, 50, 50, 8);
        ctx.clip();
        ctx.drawImage(iconImg, ax + 6, ay + 24, 50, 50);
        ctx.restore();
      }
    }

    // CV
    ctx.fillStyle = "#f0d0b0";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`CV ${art.cv}`, ax + aw - 8, ay + 20);

    // Main stat name + value
    if (art.mainStat) {
      const mainLabel = STAT_NAMES[art.mainStat.key] || art.mainStat.key;
      ctx.fillStyle = TEXT_MAIN;
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(mainLabel, ax + 62, ay + 38);

      const pctMain = ["FIGHT_PROP_HP_PERCENT","FIGHT_PROP_ATTACK_PERCENT","FIGHT_PROP_DEFENSE_PERCENT","FIGHT_PROP_CRITICAL","FIGHT_PROP_CRITICAL_HURT","FIGHT_PROP_CHARGE_EFFICIENCY","FIGHT_PROP_HEAL_ADD","FIGHT_PROP_FIRE_ADD_HURT","FIGHT_PROP_WATER_ADD_HURT","FIGHT_PROP_WIND_ADD_HURT","FIGHT_PROP_ELEC_ADD_HURT","FIGHT_PROP_ICE_ADD_HURT","FIGHT_PROP_ROCK_ADD_HURT","FIGHT_PROP_GRASS_ADD_HURT","FIGHT_PROP_PHYSICAL_ADD_HURT"].includes(art.mainStat.key);
      const mainVal = pctMain ? `${art.mainStat.value.toFixed(1)}%` : Math.round(art.mainStat.value);
      ctx.fillStyle = TEXT_MUTED;
      ctx.font = "10px sans-serif";
      ctx.fillText(`${mainVal}`, ax + 62, ay + 52);
    }

    // Substats divider
    let subY = ay + 92;
    ctx.fillStyle = NILOU_RED;
    ctx.fillRect(ax + 8, subY - 8, aw - 16, 1);
    subY += 4;

    // Substats
    for (const sub of art.subStats.slice(0, 4)) {
      const name = STAT_NAMES[sub.key] || sub.key;
      const isCrit = sub.key === "FIGHT_PROP_CRITICAL" || sub.key === "FIGHT_PROP_CRITICAL_HURT";
      ctx.fillStyle = isCrit ? "#ffd700" : TEXT_MUTED;
      ctx.font = isCrit ? "bold 10px sans-serif" : "10px sans-serif";
      ctx.textAlign = "left";
      const pct = ["FIGHT_PROP_HP_PERCENT","FIGHT_PROP_ATTACK_PERCENT","FIGHT_PROP_DEFENSE_PERCENT","FIGHT_PROP_CRITICAL","FIGHT_PROP_CRITICAL_HURT","FIGHT_PROP_CHARGE_EFFICIENCY","FIGHT_PROP_HEAL_ADD","FIGHT_PROP_FIRE_ADD_HURT","FIGHT_PROP_WATER_ADD_HURT","FIGHT_PROP_WIND_ADD_HURT","FIGHT_PROP_ELEC_ADD_HURT","FIGHT_PROP_ICE_ADD_HURT","FIGHT_PROP_ROCK_ADD_HURT","FIGHT_PROP_GRASS_ADD_HURT","FIGHT_PROP_PHYSICAL_ADD_HURT"].includes(sub.key);
      const valStr = pct ? `${sub.value.toFixed(1)}%` : Math.round(sub.value).toLocaleString();
      ctx.fillText(`${name}: ${valStr}`, ax + 8, subY);
      subY += 16;
    }
  }

  // ── Footer ──
  ctx.fillStyle = TEXT_MUTED;
  ctx.font = "11px sans-serif";
  ctx.textAlign = "left";
  if (hideDetails) {
    ctx.fillStyle = "#0d0509";
    ctx.fillRect(artX, H - 38, 260, 25);
    ctx.fillStyle = TEXT_MUTED;
    ctx.fillText("UID & name hidden", artX, H - 22);
  } else {
    ctx.fillText(`UID: ${playerInfo.uid} \u00b7 ${playerInfo.nickname}`, artX, H - 22);
  }

  ctx.fillStyle = NILOU_RED;
  ctx.font = "11px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("Nilou Bot \u00b7 Enka.Network", W - 20, H - 22);

  return canvas.toBuffer("image/png");
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
