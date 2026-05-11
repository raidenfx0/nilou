import { createCanvas, loadImage } from "@napi-rs/canvas";

const W = 700, H = 220;
const ROSE = "#E84057";

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

export async function createLevelCard({ username, avatarUrl, level, rewardLines = [] }) {
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext("2d");

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0d0010");
  bg.addColorStop(1, "#200020");
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, W, H, 18);
  ctx.fill();

  // Glow border
  ctx.shadowColor = ROSE;
  ctx.shadowBlur  = 18;
  ctx.strokeStyle = ROSE;
  ctx.lineWidth   = 3;
  roundRect(ctx, 3, 3, W - 6, H - 6, 15);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Decorative corner lines
  ctx.strokeStyle = "rgba(232,64,87,0.3)";
  ctx.lineWidth   = 1;
  for (let i = 0; i < 3; i++) {
    ctx.strokeRect(6 + i * 4, 6 + i * 4, W - 12 - i * 8, H - 12 - i * 8);
  }

  // Avatar
  const AX = 110, AY = 110, AR = 72;
  try {
    const img = await loadImage(avatarUrl.replace(/\?.*$/, "") + "?size=256");
    ctx.save();
    ctx.beginPath();
    ctx.arc(AX, AY, AR, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, AX - AR, AY - AR, AR * 2, AR * 2);
    ctx.restore();
  } catch {
    ctx.fillStyle = "#2a0015";
    ctx.beginPath();
    ctx.arc(AX, AY, AR, 0, Math.PI * 2);
    ctx.fill();
  }

  // Avatar ring
  ctx.strokeStyle = ROSE;
  ctx.lineWidth   = 4;
  ctx.beginPath();
  ctx.arc(AX, AY, AR + 5, 0, Math.PI * 2);
  ctx.stroke();

  // Sparkle dots
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const sx    = AX + (AR + 18) * Math.cos(angle);
    const sy    = AY + (AR + 18) * Math.sin(angle);
    ctx.fillStyle = i % 2 === 0 ? ROSE : "rgba(232,64,87,0.3)";
    ctx.beginPath();
    ctx.arc(sx, sy, i % 2 === 0 ? 3 : 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // "LEVEL UP!" text with glow
  ctx.shadowColor = ROSE;
  ctx.shadowBlur  = 14;
  ctx.fillStyle   = ROSE;
  ctx.font        = "bold 42px 'Arial', sans-serif";
  ctx.fillText("LEVEL UP!", 205, 72);
  ctx.shadowBlur  = 0;

  // Username
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font      = "bold 22px 'Arial', sans-serif";
  ctx.fillText(username.length > 18 ? username.slice(0, 17) + "…" : username, 205, 108);

  // Level badge
  const badgeX = 205, badgeY = 120, badgeW = 110, badgeH = 34;
  const badgeGrad = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeW, badgeY);
  badgeGrad.addColorStop(0, "#E84057");
  badgeGrad.addColorStop(1, "#c0273d");
  ctx.fillStyle = badgeGrad;
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 8);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font      = "bold 20px 'Arial', sans-serif";
  ctx.fillText(`Level ${level}`, badgeX + 10, badgeY + 23);

  // Reward lines
  ctx.font = "17px 'Arial', sans-serif";
  let ry = 168;
  for (const line of rewardLines.slice(0, 2)) {
    // Icon column bg
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    roundRect(ctx, 205, ry - 16, W - 230, 22, 4);
    ctx.fill();

    ctx.fillStyle = "#f0c0c8";
    ctx.fillText(line, 212, ry);
    ry += 26;
  }

  return canvas.toBuffer("image/png");
}
