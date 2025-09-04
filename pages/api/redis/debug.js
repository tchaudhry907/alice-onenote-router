// /pages/api/redis/debug.js
import { Redis } from "@upstash/redis";

function mask(t) {
  if (!t) return null;
  const head = t.slice(0, 6);
  const tail = t.slice(-4);
  return `${head}…${tail} (len:${t.length})`;
}

export default async function handler(req, res) {
  const url = process.env.UPSTASH_REDIS_REST_URL || null;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || null;

  const envInfo = {
    hasUrl: Boolean(url),
    hasToken: Boolean(token),
    url,
    tokenMasked: mask(token),
  };

  if (!url || !token) {
    return res.status(500).json({
      ok: false,
      reason: "Missing env vars on the PROJECT",
      envInfo,
      fix: "Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN under Project → Settings → Environment Variables, then redeploy (Skip build cache).",
    });
  }

  try {
    const redis = new Redis({ url, token });
    const pong = await redis.ping();
    return res.status(200).json({ ok: true, pong, envInfo });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      reason: "Redis ping failed",
      error: String(e?.message || e),
      envInfo,
    });
  }
}
