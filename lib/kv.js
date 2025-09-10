// lib/kv.js
// Upstash REST KV wrapper with both "kvGet/kvSet" and "get/set" exports.

const BASE = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN;

if (!BASE || !TOKEN) {
  console.warn('[lib/kv] KV_REST_API_URL or KV_REST_API_TOKEN not set');
}

async function http(method, path, { searchParams, body } = {}) {
  const url = new URL(path, BASE);
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`[KV ${method} ${url.pathname}] ${res.status} ${txt}`);
  }
  return res.json().catch(() => ({}));
}

// ---------- helpers ----------
export async function kvGet(key) {
  const r = await http('GET', `/get/${encodeURIComponent(key)}`);
  if (!r || typeof r.result === 'undefined' || r.result === null) return null;
  try { return JSON.parse(r.result); } catch { return r.result; }
}

export async function kvSet(key, value, ttlSeconds) {
  const body = { value: typeof value === 'string' ? value : JSON.stringify(value) };
  const searchParams = {};
  if (Number.isFinite(ttlSeconds)) searchParams.ex = ttlSeconds;
  return http('POST', `/set/${encodeURIComponent(key)}`, { searchParams, body });
}

export async function kvDel(key) {
  return http('DELETE', `/del/${encodeURIComponent(key)}`);
}

export async function kvExpire(key, ttlSeconds) {
  return http('POST', `/expire/${encodeURIComponent(key)}`, { body: { ex: ttlSeconds } });
}

/** NEW: ping for health-check endpoint */
export async function kvPing() {
  try {
    // Upstash REST supports GET /ping -> { result: "PONG" }
    const r = await http('GET', `/ping`);
    return r?.result === 'PONG' || true;
  } catch (e) {
    console.warn('[lib/kv] ping failed:', e.message);
    return false;
  }
}

// Object-style and alias exports (so old/new imports both work)
export const kv = { get: kvGet, set: kvSet, del: kvDel, expire: kvExpire, ping: kvPing };
export const get = kvGet;
export const set = kvSet;
export const ping = kvPing;     // <-- this satisfies pages/api/redis/ping.js

// Legacy placeholder so old imports don't break
export const redis = null;

export default kv;
