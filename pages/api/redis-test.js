// /pages/api/redis-test.js
import { getRedis } from "../../lib/redis";

export default async function handler(req, res) {
  try {
    const r = getRedis();
    const key = "vercel_redis_smoke";
    const now = new Date().toISOString();
    await r.set(key, now);
    const value = await r.get(key);
    res.status(200).json({ ok: true, wrote: now, read: value });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
