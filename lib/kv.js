// lib/kv.js
import { Redis } from "@upstash/redis";

export const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

export async function ping() {
  return kv.ping();
}

export async function get(key) {
  return kv.get(key);
}

export async function set(key, value, ttl) {
  if (ttl) return kv.set(key, value, { ex: Number(ttl) });
  return kv.set(key, value);
}
