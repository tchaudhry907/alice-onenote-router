// lib/kv.js
// Upstash Redis via REST (no SDK). We export helpers AND a {kv} object
// so all import styles work:
//   import { kvSet, kvGet, kvDel } from "@/lib/kv"
//   import { set, get, del } from "@/lib/kv"
//   import { kv } from "@/lib/kv"
//   import kvDefault from "@/lib/kv"

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || "";
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";

if (!REDIS_URL || !REDIS_TOKEN) {
  console.warn("[kv] Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN");
}

async function upstash(cmd) {
  const res = await fetch(REDIS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Upstash error ${res.status}: ${t}`);
  }
  return res.json();
}

export async function kvSet(key, value, ttlSeconds = 0) {
  const payload = JSON.stringify(value);
  const body = ttlSeconds > 0
    ? ["SETEX", key, ttlSeconds, payload]
    : ["SET", key, payload];
  return upstash({ body });
}

export async function kvGet(key) {
  const j = await upstash({ body: ["GET", key] });
  if (!j || j.result == null) return null;
  try { return JSON.parse(j.result); } catch { return j.result; }
}

export async function kvDel(key) {
  return upstash({ body: ["DEL", key] });
}

// Compatibility short names
export const set = kvSet;
export const get = kvGet;
export const del = kvDel;

// Named object form (some modules do `import { kv } from "@/lib/kv"`)
export const kv = { set: kvSet, get: kvGet, del: kvDel, kvSet, kvGet, kvDel };

// Default export (in case any file uses default import)
export default kv;
