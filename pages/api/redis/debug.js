// pages/api/redis/debug.js
import { Redis } from "@upstash/redis";

export default async function handler(req, res) {
  const url = process.env.UPSTASH_REDIS_REST_URL || null;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || null;

  if (!url || !token) {
    return res.status(500).json({
      ok: false,
      step: "env",
      message: "Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN"
    });
  }

  try {
    const redis = new Redis({ url, token });
    const pong = await redis.ping(); // should be "PONG"
    return res.status(200).json({ ok: true, ping: pong });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      step: "sdk",
      name: e?.name,
      message: e?.message
    });
  }
}
