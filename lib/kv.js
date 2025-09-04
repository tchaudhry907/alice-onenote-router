// /lib/kv.js
import { Redis } from "@upstash/redis";

// lazy singleton so we don't throw at import-time
let _client = null;

function requireEnv(name) {
  const v = process.env[name];
  if (!v || String(v).trim().length === 0) {
    throw new Error(`Missing required env: ${name}`);
  }
  return String(v).trim();
}

export function getClient() {
  if (_client) return _client;
  const url = requireEnv("UPSTASH_REDIS_REST_URL");
  const token = requireEnv("UPSTASH_REDIS_REST_TOKEN");
  _client = new Redis({ url, token });
  return _client;
}

// Small helpers used by the API routes
export async function ping() { return getClient().ping(); }
export async function get(key) { return getClient().get(key); }
export async function set(key, value, opts) { return getClient().set(key, value, opts); }
export async function ttl(key) { return getClient().ttl(key); }
export async function del(key) { return getClient().del(key); }
export async function expire(key, seconds) { return getClient().expire(key, seconds); }
