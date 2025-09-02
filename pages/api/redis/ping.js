// pages/api/redis/ping.js
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  try {
    const pong = await redis.ping();
    res.status(200).json({ success: true, pong });
  } catch (error) {
    console.error("Redis ping error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}
