// lib/kv.js  — JS version, no extra npm deps.
// Falls back to in-memory if KV env vars are not present.
// Exports BOTH {kvGet, kvSet, kvDel} and {get, set, del} aliases,
// plus a minimal `redis` object so `import { redis } from '@/lib/kv'` works.

const KV_URL  = process.env.KV_REST_API_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || '';

/** Shared in-memory fallback (non-persistent, same-instance only) */
const mem = (globalThis.__ALICE_KV__ = globalThis.__ALICE_KV__ || new Map());

async function memGet(key) {
  return mem.has(key) ? mem.get(key) : null;
}
async function memSet(key, value, opts = {}) {
  // store strings; serialize objects
  const v = typeof value === 'string' ? value : JSON.stringify(value);
  mem.set(key, v);
  return 'OK';
}
async function memDel(key) {
  mem.delete(key);
  return 1;
}

/** REST helpers for Vercel KV (Upstash Redis REST) */
async function kvRest(method, pathParts, body) {
  const url = [KV_URL.replace(/\/+$/, ''), ...pathParts].join('/');
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`KV ${method} ${url} -> ${res.status}: ${text}`);
  }
  return res.json().catch(() => ({}));
}

const hasKV = Boolean(KV_URL && KV_TOKEN);

/** Public API */
async function kvGet(key) {
  if (!hasKV) return memGet(key);
  // Upstash REST: GET {url}/get/{key}
  const data = await kvRest('GET', ['get', encodeURIComponent(key)]);
  // Upstash returns { result: "value" | null }
  return data && typeof data.result !== 'undefined' ? data.result : null;
}

async function kvSet(key, value, opts = {}) {
  if (!hasKV) return memSet(key, value, opts);
  // Upstash SET supports PX (ms) or EX (sec). Accept opts.ttlMs or opts.ttlSec.
  const payload = {};
  let setPath = ['set', encodeURIComponent(key), encodeURIComponent(
    typeof value === 'string' ? value : JSON.stringify(value)
  )];
  if (opts.ttlMs) setPath.push('PX', String(opts.ttlMs));
  if (opts.ttlSec) setPath.push('EX', String(opts.ttlSec));
  const data = await kvRest('GET', setPath, payload);
  return data?.result ?? 'OK';
}

async function kvDel(key) {
  if (!hasKV) return memDel(key);
  const data = await kvRest('GET', ['del', encodeURIComponent(key)]);
  return data?.result ?? 1;
}

// Aliases some code imports
const get = kvGet;
const set = kvSet;
const del = kvDel;

// Minimal redis-like shim for places that `import { redis } from '@/lib/kv'`
const redis = { get: kvGet, set: kvSet, del: kvDel };

// Default export (optional)
export default { kvGet, kvSet, kvDel, get, set, del, redis };
export { kvGet, kvSet, kvDel, get, set, del, redis };
