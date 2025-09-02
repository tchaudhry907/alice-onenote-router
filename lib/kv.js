// lib/kv.js - ultra-light Upstash Redis REST helper using global fetch (Node 18+)
const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;

if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
  console.warn("Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN");
}

// Basic REST call
async function redisCall(method, path) {
  const url = `${UPSTASH_REDIS_REST_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Upstash ${method} ${path} -> ${res.status} ${text}`);
  }
  return res.json();
}

// Commands
async function kvGet(key) {
  // GET /get/{key}
  return redisCall("GET", `/get/${encodeURIComponent(key)}`);
}
async function kvSet(key, value, ttlSeconds) {
  // POST /set/{key}/{value}?EX=ttl
  const qp = typeof ttlSeconds === "number" ? `?EX=${ttlSeconds}` : "";
  return redisCall("POST", `/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}${qp}`);
}
async function kvPing() {
  // GET /ping
  return redisCall("GET", `/ping`);
}

module.exports = { kvGet, kvSet, kvPing };
