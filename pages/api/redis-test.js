// pages/api/redis-test.js
import { getRedis } from "../../lib/redis";

export default async function handler(req, res) {
  try {
    const redis = getRedis();

    // Write a test key
    await redis.set("alice:test", "Hello from Redis!");

    // Read it back
    const value = await redis.get("alice:test");

    res.status(200).json({
      ok: true,
      wrote: "alice:test",
      value,
    });
  } catch (err) {
    console.error("Redis test error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
