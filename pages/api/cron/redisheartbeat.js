// pages/api/cron/redis-heartbeat.js
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  try {
    const now = new Date().toISOString();

    // Write a small heartbeat key with a TTL (so DB stays lean)
    await redis.set("alice:keepalive:last", now, { ex: 60 * 60 * 24 }); // 24h
    await redis.incr("alice:keepalive:counter");

    // Optional read (registers traffic both directions)
    const pong = await redis.ping();

    return res.status(200).json({
      ok: true,
      pong,
      time: now
    });
  } catch (err) {
    console.error("Redis heartbeat failed", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
