import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

export default async function handler(req, res) {
  try {
    const pong = await redis.ping();
    const now = new Date().toISOString();
    res.status(200).json({ ok: true, pong, time: now });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
}
