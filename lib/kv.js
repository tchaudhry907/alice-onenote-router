// lib/kv.js
// Upstash Redis via REST (no SDK). Exports both kv* and short names for compatibility.

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
    // Next.js: no-cache so we always hit Upstash
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

// ---- Compatibility aliases (what other files are importing) ----
export const set = kvSet;
export const get = kvGet;
export const del = kvDel;

// (Optional) simple list helpers if you need them later:
// export async function kvKeys(pattern = "*") { return upstash({ body: ["KEYS", pattern] }); }
// export async function kvTtl(key) { return upstash({ body: ["TTL", key] }); }
