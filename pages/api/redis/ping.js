// pages/api/redis/ping.js
import { getRedis } from '../../../lib/redis';

export default async function handler(req, res) {
  try {
    const redis = getRedis();
    const pong = await redis.ping(); // Upstash returns "PONG"
    return res.status(200).json({ ok: true, pong });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
