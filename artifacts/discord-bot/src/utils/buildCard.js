import { createCanvas, loadImage } from "@napi-rs/canvas";
import { EQUIP_TYPE_NAMES, STAT_NAMES, ENKA_CDN } from "./genshinData.js";

const NILOU_RED  = "#E84057";
const CARD_BG    = "#0d0509";
const PANEL_BG   = "#1a0a10";
const TEXT_MAIN  = "#fff8f0";
const TEXT_MUTED = "#b08090";

const STAR_COLORS = ["#6b6b6b", "#4a9eff", "#b266ff", "#ffaa00", "#ffcc00", "#ff5e5e"];

async function tryLoadImage(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return await loadImage(buf);
  } catch { return null; }
}

export async function generateBuildCard(character, playerInfo, hideDetails = false) {
  const W = 860, H = 540;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext("2d");

  // Background
  ctx.fillStyle = CARD_BG;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = PANEL_BG;
  roundRect(ctx, 10, 10, W - 20, H - 20, 16);
  ctx.fill();

  const leftSideW = 240;

  // Left panel
  ctx.fillStyle = "#120608";
  roundRect(ctx, 10, 10, leftSideW, H - 20, 16);
  ctx.fill();

  // Character image (try gacha splash first, then side icon, then fallback)
  let charImg = null;
  const gachaUrl = `${ENKA_CDN}/${iconName(character.avatarId)}_Card.png`;
  const sideUrl  = `${ENKA_CDN}/${iconName(character.avatarId)}.png`;

  charImg = await tryLoadImage(gachaUrl);
  if (!charImg) charImg = await tryLoadImage(sideUrl);

  const imgW = leftSideW - 20;
  const imgH = 220;
  if (charImg) {
    ctx.save();
    roundRect(ctx, 20, 20, imgW, imgH, 12);
    ctx.clip();
    // Center-crop the image into the slot
    const scale = Math.max(imgW / charImg.width, imgH / charImg.height);
    const dw = charImg.width * scale;
    const dh = charImg.height * scale;
    const dx = 20 + (imgW - dw) / 2;
    const dy = 20 + (imgH - dh) / 2;
    ctx.drawImage(charImg, dx, dy, dw, dh);
    ctx.restore();
  } else {
    ctx.fillStyle = "#2a0f18";
    roundRect(ctx, 20, 20, imgW, imgH, 12);
    ctx.fill();
    ctx.fillStyle = NILOU_RED;
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(character.name, leftSideW / 2 + 10, 130);
  }

  // Divider
  ctx.fillStyle = NILOU_RED;
  ctx.fillRect(10, 248, leftSideW, 2);

  // Name + Constellation stars
  ctx.fillStyle = TEXT_MAIN;
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(character.name, leftSideW / 2 + 10, 272);

  // Constellation stars (C0-C6)
  const c = Math.min(character.constellations || 0, 6);
  const starStr = "★".repeat(c) + "☆".repeat(6 - c);
  ctx.fillStyle = c >= 6 ? "#ff5e5e" : c >= 4 ? "#ffcc00" : c >= 2 ? "#b266ff" : TEXT_MUTED;
  ctx.font = "14px sans-serif";
  ctx.fillText(`C${c} ${starStr}`, leftSideW / 2 + 10, 292);

  // Level + Total CV
  ctx.fillStyle = TEXT_MUTED;
  ctx.font = "13px sans-serif";
  ctx.fillText(`Lv.${character.level} · Total CV ${character.totalCV}`, leftSideW / 2 + 10, 310);

  // Stats
  const stats = [
    ["HP",    Math.round(character.hp)],
    ["ATK",   Math.round(character.atk)],
    ["DEF",   Math.round(character.def)],
    ["EM",    Math.round(character.em)],
    ["ER",    `${character.er}%`],
    ["CR",    `${character.critRate}%`],
    ["CD",    `${character.critDmg}%`],
  ];
  if (character.elementBonus > 0 && character.elementName) {
    stats.push([`${character.elementName} DMG`, `${character.elementBonus}%`]);
  }

  let sy = 340;
  for (const [label, val] of stats) {
    ctx.textAlign = "left";
    ctx.fillStyle = TEXT_MUTED;
    ctx.font = "11px sans-serif";
    ctx.fillText(label, 20, sy);
    ctx.textAlign = "right";
    ctx.fillStyle = TEXT_MAIN;
    ctx.font = "11px sans-serif";
    ctx.fillText(String(val), leftSideW - 5, sy);
    sy += 18;
  }

  // ── Weapon panel ────────────────────────────────────────────────────
  if (character.weapon) {
    const w = character.weapon;
    const wy = H - 75;
    ctx.fillStyle = "#1f0a12";
    roundRect(ctx, 16, wy, leftSideW - 12, 50, 8);
    ctx.fill();

    // Weapon icon
    if (w.icon) {
      const wImg = await tryLoadImage(`${ENKA_CDN}/${w.icon}.png`);
      if (wImg) {
        ctx.save();
        roundRect(ctx, 22, wy + 5, 40, 40, 6);
        ctx.clip();
        ctx.drawImage(wImg, 22, wy + 5, 40, 40);
        ctx.restore();
      }
    }

    // Weapon stars
    const stars = "★".repeat(w.rankLevel || 1);
    ctx.fillStyle = TEXT_MAIN;
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`R${w.refinement} ${stars}`, 68, wy + 20);

    ctx.fillStyle = TEXT_MUTED;
    ctx.font = "10px sans-serif";
    ctx.fillText(`Lv.${w.level}`, 68, wy + 38);

    // Weapon stat preview
    if (w.stats && w.stats.length > 0) {
      const firstStat = w.stats[0];
      const sName = STAT_NAMES[firstStat.key] || firstStat.key;
      const isPct = firstStat.value < 10; // rough heuristic for percentage
      const sVal = isPct ? `${firstStat.value.toFixed(1)}%` : Math.round(firstStat.value);
      ctx.textAlign = "right";
      ctx.fillStyle = TEXT_MUTED;
      ctx.fillText(`${sName}: ${sVal}`, leftSideW - 10, wy + 28);
    }
  }

  // ── Artifacts grid ─────────────────────────────────────────────────────────
  const artX    = leftSideW + 30;
  const artW    = (W - artX - 20) / 3;
  const artifactTypes = ["EQUIP_BRACER","EQUIP_NECKLACE","EQUIP_SHOES","EQUIP_RING","EQUIP_DRESS"];

  for (let i = 0; i < Math.min(5, artifactTypes.length); i++) {
    const art = character.artifacts.find(a => a.equipType === artifactTypes[i]);
    const col  = i % 3;
    const row  = Math.floor(i / 3);
    const ax   = artX + col * (artW + 8);
    const ay   = 20 + row * 250;
    const aw   = artW;
    const ah   = 235;

    ctx.fillStyle = "#200c12";
    roundRect(ctx, ax, ay, aw, ah, 10);
    ctx.fill();

    ctx.strokeStyle = NILOU_RED + "44";
    ctx.lineWidth   = 1;
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

    // Main stat
    if (art.mainStat) {
      ctx.fillStyle = TEXT_MAIN;
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "left";
      const mainLabel = STAT_NAMES[art.mainStat.key] || art.mainStat.key;
      ctx.fillText(mainLabel, ax + 62, ay + 40);
      // Main stat value
      const isPct = art.mainStat.key.includes("PERCENT") || art.mainStat.key.includes("CRITICAL") || art.mainStat.key.includes("HURT") || art.mainStat.key.includes("EFFICIENCY") || art.mainStat.key.includes("ADD_HURT") || art.mainStat.key.includes("HEAL_ADD");
      const mainVal = isPct ? `${art.mainStat.value.toFixed(1)}%` : Math.round(art.mainStat.value);
      ctx.fillStyle = TEXT_MUTED;
      ctx.font = "10px sans-serif";
      ctx.fillText(`${mainVal}`, ax + 62, ay + 54);
    }

    // Substats divider
    let subY = ay + 88;
    ctx.fillStyle = NILOU_RED;
    ctx.fillRect(ax + 8, subY - 8, aw - 16, 1);
    subY += 4;

    // Substats
    for (const sub of art.subStats.slice(0, 4)) {
      const name   = STAT_NAMES[sub.key] || sub.key;
      const isCrit = sub.key === "FIGHT_PROP_CRITICAL" || sub.key === "FIGHT_PROP_CRITICAL_HURT";
      ctx.fillStyle = isCrit ? "#ffd700" : TEXT_MUTED;
      ctx.font = isCrit ? "bold 10px sans-serif" : "10px sans-serif";
      ctx.textAlign = "left";
      const isPct = name.includes("Rate") || name.includes("DMG") || name.includes("%") || name.includes("Recharge") || name.includes("Bonus");
      const valStr = isPct ? `${sub.value.toFixed(1)}%` : Math.round(sub.value).toLocaleString();
      ctx.fillText(`${name}: ${valStr}`, ax + 8, subY);
      subY += 16;
    }
  }

  // Footer
  ctx.fillStyle = TEXT_MUTED;
  ctx.font = "11px sans-serif";
  ctx.textAlign = "left";
  if (hideDetails) {
    ctx.fillStyle = "#0d0509";
    ctx.fillRect(artX, H - 38, 260, 25);
    ctx.fillStyle = TEXT_MUTED;
    ctx.fillText("UID & name hidden", artX, H - 22);
  } else {
    ctx.fillText(`UID: ${playerInfo.uid} · ${playerInfo.nickname}`, artX, H - 22);
  }

  ctx.fillStyle = NILOU_RED;
  ctx.font = "11px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("Nilou Bot · Enka.Network", W - 20, H - 22);

  return canvas.toBuffer("image/png");
}

function iconName(avatarId) {
  const MAP = {
    10000052: "UI_AvatarIcon_Shougun",
    10000046: "UI_AvatarIcon_Hutao",
    10000058: "UI_AvatarIcon_Yae",
    10000069: "UI_AvatarIcon_Nilou",
    10000088: "UI_AvatarIcon_Furina",
    10000086: "UI_AvatarIcon_Neuvillette",
    10000095: "UI_AvatarIcon_Arlecchino",
  };
  return MAP[avatarId] || `UI_AvatarIcon_${avatarId}`;
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
