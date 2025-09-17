// KV_FILE_VERSION: v7-2025-09-17
// lib/kv.js — Upstash Redis REST client
// Exports:
//   - named: get, set, del, ping
//   - alias named: kvGet, kvSet, kvDel, kvPing
//   - aggregate: kv
//   - default: kv

const BASE = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

if (!BASE || !TOKEN) {
  console.warn('[kv] Missing UPSTASH_REDIS_REST_URL/TOKEN (or KV_REST_API_URL/TOKEN)');
}

async function call(method, path, body) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`[kv] ${res.status} ${res.statusText}: ${t}`);
  }
  return res.json();
}

export async function get(key) {
  const r = await call('GET', `/get/${encodeURIComponent(key)}`);
  if (r?.result == null) return null;
  try { return JSON.parse(r.result); } catch { return r.result; }
}

export async function set(key, value, opts = {}) {
  const p = new URLSearchParams();
  if (opts.ex) p.set('ex', String(opts.ex));
  if (opts.px) p.set('px', String(opts.px));
  const qs = p.toString() ? `?${p}` : '';
  const val = typeof value === 'string' ? value : JSON.stringify(value);
  const r = await call('POST', `/set/${encodeURIComponent(key)}${qs}`, val);
  return r.result === 'OK';
}

export async function del(key) {
  const r = await call('DELETE', `/del/${encodeURIComponent(key)}`);
  return r.result || 0;
}

export async function ping() {
  try {
    await set('kv:ping', '1', { ex: 5 });
    const v = await get('kv:ping');
    return { ok: v === '1' || v === 1 || v === '"1"' };
  } catch (e) { return { ok: false, error: e.message }; }
}

// Alias exports for existing callers
export const kvGet = get;
export const kvSet = set;
export const kvDel = del;
export const kvPing = ping;

// Aggregate + default
export const kv = { get, set, del, ping, kvGet, kvSet, kvDel, kvPing };
export default kv;
