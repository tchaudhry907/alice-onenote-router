// pages/api/redis-test.js
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv(); // requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel env

export default async function handler(req, res) {
  try {
    const key = "alice:test";
    const now = new Date().toISOString();

    await redis.set(key, now);
    const value = await redis.get(key);

    res.status(200).json({ ok: true, wrote: now, read: value });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}
