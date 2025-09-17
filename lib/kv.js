// KV_FILE_VERSION: v10-2025-09-17
// lib/kv.js — Upstash Redis REST client (correct REST verbs)

const BASE = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

if (!BASE || !TOKEN) {
  console.warn('[kv] Missing UPSTASH_REDIS_REST_URL/TOKEN (or KV_REST_API_URL/TOKEN)');
}

async function http(method, path) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`[kv] ${res.status} ${res.statusText}: ${t}`);
  }
  return res.json();
}

export async function get(key) {
  const r = await http('GET', `/get/${encodeURIComponent(key)}`);
  if (r?.result == null) return null;
  try { return JSON.parse(r.result); } catch { return r.result; }
}

export async function set(key, value, opts = {}) {
  // Upstash SET: POST /set/{key}/{value}?ex=seconds&px=ms
  const val = typeof value === 'string' ? value : JSON.stringify(value);
  const p = new URLSearchParams();
  if (opts.ex) p.set('ex', String(opts.ex));
  if (opts.px) p.set('px', String(opts.px));
  const qs = p.toString() ? `?${p}` : '';
  const path = `/set/${encodeURIComponent(key)}/${encodeURIComponent(val)}${qs}`;
  const r = await http('POST', path);
  return r?.result === 'OK';
}

export async function del(key) {
  // Upstash DEL: POST /del/{key}
  const r = await http('POST', `/del/${encodeURIComponent(key)}`);
  return typeof r?.result === 'number' ? r.result : Number(r?.result ?? 0);
}

export async function ping() {
  try {
    await set('kv:ping', '1', { ex: 5 });
    const v = await get('kv:ping');
    return { ok: v === '1' || v === 1 || v === '"1"' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Alias exports some files expect
export const kvGet = get;
export const kvSet = set;
export const kvDel = del;
export const kvPing = ping;

// Aggregate + default
export const kv = { get, set, del, ping, kvGet, kvSet, kvDel, kvPing };
export default kv;
