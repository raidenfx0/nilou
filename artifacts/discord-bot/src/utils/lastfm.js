/**
 * Last.fm API integration for Nilou Bot
 * Handles scrobbling and now-playing updates
 */

const API_KEY = process.env.LASTFM_API_KEY || "";
const API_SECRET = process.env.LASTFM_API_SECRET || "";
const API_URL = "https://ws.audioscrobbler.com/2.0/";

export function isConfigured() {
  return API_KEY && API_SECRET;
}

async function callApi(params, { write = false } = {}) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, api_key: API_KEY, format: "json" })) {
    if (v != null) body.set(k, String(v));
  }

  const url = new URL(API_URL);
  if (!write) {
    for (const [key, value] of body) url.searchParams.set(key, value);
  }
  const res = await fetch(write ? API_URL : url, write
    ? { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8" }, body }
    : { method: "GET", headers: { accept: "application/json" } });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(`Last.fm HTTP ${res.status}: ${data?.message || text.slice(0, 200)}`);
  return data;
}

import crypto from "crypto";
function makeSig(params, secret) {
  const sorted = Object.entries(params)
    .filter(([, v]) => v != null)
    .sort((a, b) => a[0].localeCompare(b[0]));
  const sig = sorted.map(([k, v]) => `${k}${v}`).join("") + secret;
  return crypto.createHash("md5").update(sig, "utf8").digest("hex");
}

/** Get a Last.fm auth URL for the user to visit */
export function getAuthUrl(callbackUrl) {
  const url = new URL("https://www.last.fm/api/auth");
  url.searchParams.set("api_key", API_KEY);
  if (callbackUrl) url.searchParams.set("cb", callbackUrl);
  return url.toString();
}

/** Exchange a token for a session key */
export async function getSession(token) {
   const params = { method: "auth.getSession", api_key: API_KEY, token };
  params.api_sig = makeSig(params, API_SECRET);
   const data = await callApi(params);
  if (data.error) throw new Error(`Last.fm error ${data.error}: ${data.message}`);
  return data.session;
}

/** Send a "now playing" update */
export async function updateNowPlaying(sessionKey, trackTitle, artist, album = "", durationMs = 0) {
  if (!isConfigured() || !sessionKey) return false;
  const params = {
    method: "track.updateNowPlaying",
    api_key: API_KEY,
    track: trackTitle,
    artist,
    ...(album && { album }),
    ...(durationMs > 0 && { duration: Math.floor(durationMs / 1000) }),
    sk: sessionKey,
  };
  params.api_sig = makeSig(params, API_SECRET);
  const data = await callApi(params, { write: true });
  if (data.error) {
    console.error("Last.fm nowPlaying error:", data.message);
    return false;
  }
  return true;
}

/** Scrobble a completed track (call after ~30s or 50% played) */
export async function scrobble(sessionKey, trackTitle, artist, album = "", durationMs = 0, timestamp = null) {
  if (!isConfigured() || !sessionKey) return false;
  const ts = timestamp || Math.floor(Date.now() / 1000);
  const params = {
    method: "track.scrobble",
    api_key: API_KEY,
    track: trackTitle,
    artist,
    ...(album && { album }),
    ...(durationMs > 0 && { duration: Math.floor(durationMs / 1000) }),
    timestamp: ts,
    sk: sessionKey,
  };
  params.api_sig = makeSig(params, API_SECRET);
  const data = await callApi(params, { write: true });
  if (data.error) {
    console.error("Last.fm scrobble error:", data.message);
    return false;
  }
  return true;
}

/** Get user profile info */
export async function getUserInfo(username) {
  const data = await callApi({ method: "user.getInfo", user: username });
  return data?.user || null;
}
