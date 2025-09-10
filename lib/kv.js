// lib/kv.js
//
// Minimal Upstash REST KV wrapper (no SDK).
// Exposes kv.get/kv.set and named helpers kvGet/kvSet that the rest of the
// codebase imports. Also exports a legacy `redis` (null) so anything that tries
// to import it won’t fail at build time.

const BASE = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN;

if (!BASE || !TOKEN) {
  console.warn('[lib/kv] KV_REST_API_URL or KV_REST_API_TOKEN not set');
}

async function http(method, path, { searchParams, body } = {}) {
  const url = new URL(path, BASE);
  if (searchParams) {
    Object.entries(searchParams).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
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

// ----- Public helpers expected elsewhere in the app -----

// Get JSON value for key (returns null if missing)
export async function kvGet(key) {
  const r = await http('GET', `/get/${encodeURIComponent(key)}`);
  // Upstash returns { result: "..." } for strings or serialized data
  if (!r || typeof r.result === 'undefined' || r.result === null) return null;
  // Try to parse JSON; if it fails, return raw
  try {
    return JSON.parse(r.result);
  } catch {
    return r.result;
  }
}

// Set JSON value; optional ttlSeconds
export async function kvSet(key, value, ttlSeconds) {
  const body = { value: typeof value === 'string' ? value : JSON.stringify(value) };
  const searchParams = {};
  if (Number.isFinite(ttlSeconds)) searchParams.ex = ttlSeconds;
  const r = await http('POST', `/set/${encodeURIComponent(key)}`, { searchParams, body });
  return r; // usually { result: 'OK' }
}

// Optional extras some code may expect
export async function kvDel(key) {
  return http('DELETE', `/del/${encodeURIComponent(key)}`);
}
export async function kvExpire(key, ttlSeconds) {
  return http('POST', `/expire/${encodeURIComponent(key)}`, { body: { ex: ttlSeconds } });
}

// Object-style alias (some files import { kv } and call kv.get / kv.set)
export const kv = {
  get: kvGet,
  set: kvSet,
  del: kvDel,
  expire: kvExpire,
};

// Legacy placeholder export to satisfy old imports without pulling a Redis SDK.
export const redis = null;

export default kv;
