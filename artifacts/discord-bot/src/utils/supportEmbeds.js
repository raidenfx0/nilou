import { EmbedBuilder } from "discord.js";

const DEFAULT_COLOR = "#E84057";

function render(value, variables) {
  return String(value ?? "").replace(/\{([a-zA-Z0-9_.-]+)\}/g, (_, key) => {
    const replacement = variables[key];
    return replacement == null ? `{${key}}` : String(replacement);
  }).replace(/\\n/g, "\n");
}

function safeImageUrl(value) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function buildSupportEmbed(template = {}, variables = {}, fallback = {}) {
  const config = { ...fallback, ...(template || {}) };
  const embed = new EmbedBuilder();
  const title = render(config.title, variables).slice(0, 256);
  const description = render(config.description, variables).slice(0, 4000);
  const rawColor = String(config.color || DEFAULT_COLOR).replace("#", "");
  const color = /^[0-9a-f]{6}$/i.test(rawColor) ? parseInt(rawColor, 16) : parseInt(DEFAULT_COLOR.slice(1), 16);

  embed.setColor(color);
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  const footer = render(config.footer, variables).slice(0, 2048);
  if (footer) embed.setFooter({ text: footer });
  const imageUrl = safeImageUrl(render(config.imageUrl, variables));
  const thumbnailUrl = safeImageUrl(render(config.thumbnailUrl, variables));
  if (imageUrl) embed.setImage(imageUrl);
  if (thumbnailUrl) embed.setThumbnail(thumbnailUrl);
  if (config.timestamp !== false) embed.setTimestamp();
  return embed;
}

export function parseJsonObject(value, fallback = {}) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value || "{}") : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}
