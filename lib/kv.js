// lib/kv.js
// Tiny Upstash Redis REST client for JSON values.

const BASE = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN;

if (!BASE || !TOKEN) {
  console.warn("[kv] Missing KV_REST_API_URL or KV_REST_API_TOKEN");
}

async function call(method, path) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error || JSON.stringify(data) || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

export async function ping() {
  try {
    const r = await call("GET", "/ping");
    // Upstash returns { result: "PONG" }
    return r?.result === "PONG";
  } catch {
    return false;
  }
}

export async function get(key) {
  if (!key) return null;
  const r = await call("GET", `/get/${encodeURIComponent(key)}`);
  // Upstash returns { result: "<string or null>" }
  const raw = r?.result ?? null;
  if (raw == null) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}

export async function set(key, value, ttlSeconds) {
  if (!key) return false;
  const payload = encodeURIComponent(JSON.stringify(value));
  const ttl = (ttlSeconds && Number(ttlSeconds) > 0) ? `?EX=${Number(ttlSeconds)}` : "";
  const r = await call("POST", `/set/${encodeURIComponent(key)}/${payload}${ttl}`);
  // Upstash returns { result: "OK" }
  return r?.result === "OK";
}

export async function del(key) {
  if (!key) return 0;
  const r = await call("POST", `/del/${encodeURIComponent(key)}`);
  // Upstash returns { result: <deletedCount> }
  return r?.result ?? 0;
}

// Back-compat named exports some files expect:
export const kvGet = get;
export const kvSet = set;
export const kvDel = del;
export const kv = { get, set, del, ping };
