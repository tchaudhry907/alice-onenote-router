// lib/kv.js
// Thin wrapper around Upstash Redis REST.
// Works on Vercel (edge/Node) and in Next API routes.

const BASE = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!BASE || !TOKEN) {
  // Don't crash import; callers can check isConfigured
  console.warn(
    "[kv] Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN env var."
  );
}

/**
 * Post a single Redis command to Upstash.
 * Example body: { command: ["GET", "mykey"] }
 */
async function postCommand(cmdArr) {
  if (!BASE || !TOKEN) {
    throw new Error("Upstash KV not configured (missing env vars)");
  }
  const r = await fetch(BASE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ command: cmdArr }),
    // Upstash is fast; keep it snappy
    cache: "no-store",
  });

  // Upstash returns 200 OK with { result: ... } OR { error: "..."}
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(`[kv] HTTP ${r.status}: ${JSON.stringify(j)}`);
  }
  if (j && typeof j === "object" && "error" in j) {
    throw new Error(`[kv] ${j.error}`);
  }
  return j?.result;
}

async function get(key) {
  return postCommand(["GET", String(key)]);
}

/**
 * set(key, value, opts)
 * opts.ex: seconds (expire)
 * opts.px: milliseconds (expire)
 * opts.nx: only set if not exists
 * opts.xx: only set if exists
 */
async function set(key, value, opts = {}) {
  const parts = ["SET", String(key), typeof value === "string" ? value : JSON.stringify(value)];
  if (opts.ex) parts.push("EX", String(opts.ex));
  if (opts.px) parts.push("PX", String(opts.px));
  if (opts.nx) parts.push("NX");
  if (opts.xx) parts.push("XX");
  return postCommand(parts);
}

async function del(key) {
  return postCommand(["DEL", String(key)]);
}

/** Optional helpers */
async function mget(keys = []) {
  if (!Array.isArray(keys) || keys.length === 0) return [];
  return postCommand(["MGET", ...keys.map(String)]);
}

async function incr(key) {
  return postCommand(["INCR", String(key)]);
}

/** Minimal "client-like" object so callers can do `kv.get(...)` style */
export const kv = {
  get,
  set,
  del,
  mget,
  incr,
};

export { get, set, del, mget, incr };

/** Allow callers to short-circuit if envs aren’t present */
export const isConfigured =
  typeof BASE === "string" &&
  BASE.length > 0 &&
  typeof TOKEN === "string" &&
  TOKEN.length > 0;
