// lib/kv.js
// Minimal Upstash Redis helper (HTTP API). No SDK needed.

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || "";
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";

if (!REDIS_URL || !REDIS_TOKEN) {
  console.warn("[kv] Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN");
}

/** Basic POST to Upstash REST */
async function upstash(cmd) {
  const res = await fetch(REDIS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Upstash error ${res.status}: ${t}`);
  }
  return res.json();
}

export async function kvSet(key, value, ttlSeconds = 0) {
  // value -> JSON string
  const cmd = ttlSeconds > 0
    ? ["SETEX", key, ttlSeconds, JSON.stringify(value)]
    : ["SET", key, JSON.stringify(value)];
  return upstash({ body: cmd });
}

export async function kvGet(key) {
  const j = await upstash({ body: ["GET", key] });
  if (!j || j.result == null) return null;
  try { return JSON.parse(j.result); } catch { return j.result; }
}

export async function kvDel(key) {
  return upstash({ body: ["DEL", key] });
}
