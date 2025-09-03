// /pages/api/redis/ping.js
import redis, { ping as kvPing } from "@/lib/kv";

export default async function handler(req, res) {
  try {
    // Try both ways, in case tree-shaking/import style caused issues
    const pong = await (kvPing ? kvPing() : redis.ping());
    return res.status(200).json({ ok: true, pong });
  } catch (e) {
    // Return _safe_ debug info (no secrets leaked)
    return res.status(500).json({
      ok: false,
      error: String(e?.message || e),
      envPresent: {
        UPSTASH_REDIS_REST_URL: Boolean(process.env.UPSTASH_REDIS_REST_URL),
        UPSTASH_REDIS_REST_TOKEN: Boolean(process.env.UPSTASH_REDIS_REST_TOKEN),
      },
      hint:
        "If envPresent are true, but this still fails, token/URL may be wrong or not yet applied to this deployment. Redeploy with Skip Build Cache."
    });
  }
}
