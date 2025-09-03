// /lib/kv.js
import { Redis } from '@upstash/redis';

// Explicitly wire in the Vercel environment variables
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Simple ping
export async function ping() {
  return await redis.ping();
}

// Get a value
export async function get(key) {
  return await redis.get(key);
}

// Set a value with optional TTL
export async function set(key, value, ttlSeconds) {
  if (ttlSeconds) {
    return await redis.set(key, value, { ex: ttlSeconds });
  }
  return await redis.set(key, value);
}

// Get TTL of a key
export async function ttl(key) {
  return await redis.ttl(key);
}

export default redis;
