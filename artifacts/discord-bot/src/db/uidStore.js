import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dir, "uids.json");

function load() {
  if (!existsSync(DB_PATH)) return {};
  try { return JSON.parse(readFileSync(DB_PATH, "utf8")); } catch { return {}; }
}

function save(data) {
  writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf8");
}

export function registerUid(discordId, uid) {
  const data = load();
  data[discordId] = uid;
  save(data);
}

export function getUid(discordId) {
  return load()[discordId] || null;
}

export function getAllRegistered() {
  return load();
}
