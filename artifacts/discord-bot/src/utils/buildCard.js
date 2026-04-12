import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import { EQUIP_TYPE_NAMES, STAT_NAMES, formatStat } from "./genshinData.js";

const NILOU_RED  = "#E84057";
const CARD_BG    = "#0d0509";
const PANEL_BG   = "#1a0a10";
const TEXT_MAIN  = "#fff8f0";
const TEXT_MUTED = "#b08090";

async function tryLoadImage(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return await loadImage(buf);
  } catch { return null; }
}

export async function generateBuildCard(character, playerInfo, hideDetails = false) {
  const W = 860, H = 480;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext("2d");

  ctx.fillStyle = CARD_BG;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = PANEL_BG;
  roundRect(ctx, 10, 10, W - 20, H - 20, 16);
  ctx.fill();

  const leftSideW = 220;

  ctx.fillStyle = "#120608";
  roundRect(ctx, 10, 10, leftSideW, H - 20, 16);
  ctx.fill();

  const charIconUrl = `https://enka.network/ui/${iconName(character.avatarId)}.png`;
  const charImg     = await tryLoadImage(charIconUrl);
  if (charImg) {
    ctx.save();
    roundRect(ctx, 20, 20, leftSideW - 20, 200, 12);
    ctx.clip();
    ctx.drawImage(charImg, 20, 20, leftSideW - 20, 200);
    ctx.restore();
  } else {
    ctx.fillStyle = "#2a0f18";
    roundRect(ctx, 20, 20, leftSideW - 20, 200, 12);
    ctx.fill();
    ctx.fillStyle = NILOU_RED;
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(character.name, 120, 125);
  }

  ctx.fillStyle = NILOU_RED;
  ctx.fillRect(10, 228, leftSideW, 2);

  ctx.fillStyle = TEXT_MAIN;
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(character.name, leftSideW / 2 + 10, 255);

  ctx.fillStyle = TEXT_MUTED;
  ctx.font = "13px sans-serif";
  ctx.fillText(`Lv.${character.level}`, leftSideW / 2 + 10, 275);
  ctx.fillText(`CV: ${character.totalCV}`, leftSideW / 2 + 10, 295);

  const stats = [
    ["HP",    Math.round(character.hp)],
    ["ATK",   Math.round(character.atk)],
    ["DEF",   Math.round(character.def)],
    ["EM",    Math.round(character.em)],
    ["ER",    `${character.er}%`],
    ["CR",    `${character.critRate}%`],
    ["CD",    `${character.critDmg}%`],
  ];
  let sy = 320;
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

  const artX    = leftSideW + 30;
  const artW    = (W - artX - 20) / 3;
  const artifactTypes = ["EQUIP_BRACER","EQUIP_NECKLACE","EQUIP_SHOES","EQUIP_RING","EQUIP_DRESS"];

  for (let i = 0; i < Math.min(5, artifactTypes.length); i++) {
    const art = character.artifacts.find(a => a.equipType === artifactTypes[i]);
    const col  = i % 3;
    const row  = Math.floor(i / 3);
    const ax   = artX + col * (artW + 8);
    const ay   = 20 + row * 210;
    const aw   = artW;
    const ah   = 195;

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

    if (art.icon) {
      const iconImg = await tryLoadImage(`https://enka.network/ui/${art.icon}.png`);
      if (iconImg) {
        ctx.save();
        roundRect(ctx, ax + 6, ay + 24, 50, 50, 8);
        ctx.clip();
        ctx.drawImage(iconImg, ax + 6, ay + 24, 50, 50);
        ctx.restore();
      }
    }

    ctx.fillStyle = "#f0d0b0";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "right";
    const cvStr = `CV ${art.cv}`;
    ctx.fillText(cvStr, ax + aw - 8, ay + 20);

    if (art.mainStat) {
      ctx.fillStyle = TEXT_MAIN;
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "left";
      const mainLabel = STAT_NAMES[art.mainStat.key] || art.mainStat.key;
      ctx.fillText(mainLabel, ax + 62, ay + 40);
    }

    let subY = ay + 82;
    ctx.fillStyle = NILOU_RED;
    ctx.fillRect(ax + 8, subY - 8, aw - 16, 1);
    subY += 4;

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
