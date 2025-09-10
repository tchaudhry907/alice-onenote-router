// lib/store.js
// Minimal Upstash Redis REST helper; falls back to in-memory if not configured.

const UP_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_URL;
const UP_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_TOKEN;

let mem = new Map();

async function upstash(cmd, ...args) {
  if (!UP_URL || !UP_TOKEN) return null;
  const body = JSON.stringify([cmd, ...args]);
  const r = await fetch(`${UP_URL}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${UP_TOKEN}`, 'Content-Type': 'application/json' },
    body
  });
  if (!r.ok) throw new Error(`Upstash error ${r.status}: ${await r.text()}`);
  const data = await r.json();
  return data?.result;
}

export async function kvGet(key) {
  const v = await upstash('GET', key);
  if (v === null && v !== undefined) return null;
  if (v !== null && v !== undefined) return typeof v === 'string' ? v : JSON.stringify(v);
  return mem.get(key) ?? null;
}

export async function kvSet(key, value, ttlSec = 0) {
  if (UP_URL && UP_TOKEN) {
    if (ttlSec > 0) return await upstash('SETEX', key, ttlSec, value);
    return await upstash('SET', key, value);
  }
  mem.set(key, value);
  if (ttlSec > 0) setTimeout(() => mem.delete(key), ttlSec * 1000).unref?.();
  return 'OK';
}

export async function kvDel(key) {
  if (UP_URL && UP_TOKEN) return await upstash('DEL', key);
  mem.delete(key); return 1;
}
