import { Redis } from '@upstash/redis';

export const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// helper: used by /api/redis/ping.js
export async function ping() {
  try {
    return await kv.ping();
  } catch (err) {
    return `Ping failed: ${err.message}`;
  }
}
