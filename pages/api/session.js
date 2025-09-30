import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

export default async function handler(req, res) {
  try {
    const now = new Date().toISOString();
    await redis.set("alice:session:last", now, { ex: 60 * 60 * 24 });
    const count = await redis.incr("alice:session:counter");
    res.status(200).json({ ok: true, time: now, count });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
}
