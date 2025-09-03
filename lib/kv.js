// /lib/kv.js
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// convenience helpers (optional)
export async function ping() { return redis.ping(); }
export async function get(key) { return redis.get(key); }
export async function set(key, value, ttlSeconds) {
  if (ttlSeconds) return redis.set(key, value, { ex: ttlSeconds });
  return redis.set(key, value);
}
export async function ttl(key) { return redis.ttl(key); }

export default redis;
