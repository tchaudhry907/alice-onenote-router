// pages/api/redis-test.js
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  try {
    // Simple test: set and get a key
    await redis.set("test-key", "Hello from Redis!");
    const value = await redis.get("test-key");

    res.status(200).json({ success: true, value });
  } catch (error) {
    console.error("Redis test error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}
