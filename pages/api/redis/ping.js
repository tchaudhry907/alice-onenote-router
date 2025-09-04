// /pages/api/redis/ping.js
import { ping as kvPing } from "@/lib/kv";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  const verbose = "verbose" in (req.query || {});

  try {
    const pong = await kvPing();
    return res.status(200).json({
      ok: true,
      pong,
      env: {
        url: Boolean(process.env.UPSTASH_REDIS_REST_URL),
        token: Boolean(process.env.UPSTASH_REDIS_REST_TOKEN),
      },
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e?.message || String(e),
      env: verbose
        ? {
            urlPreview: (process.env.UPSTASH_REDIS_REST_URL || "").slice(0, 40),
            tokenPreview: (process.env.UPSTASH_REDIS_REST_TOKEN || "").slice(0, 6) + "…",
          }
        : undefined,
    });
  }
}
