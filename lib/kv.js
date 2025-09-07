// /lib/kv.js
import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Back-compat alias: some routes import { kv } from '@/lib/kv'
export const kv = redis;

// Convenience helpers used in routes
export async function ping() {
  return await redis.ping();
}
export async function get(key) {
  return await redis.get(key);
}
export async function set(key, value, ttlSec) {
  if (Number.isFinite(ttlSec) && ttlSec > 0) {
    return await redis.set(key, value, { ex: Math.floor(ttlSec) });
  }
  return await redis.set(key, value);
}
export async function ttl(key) {
  return await redis.ttl(key);
}
export async function expire(key, seconds) {
  return await redis.expire(key, Math.max(1, Math.floor(seconds)));
}
export async function del(key) {
  return await redis.del(key);
}
