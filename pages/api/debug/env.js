// pages/api/debug/env.js
export default function handler(req, res) {
  const url   = process.env.UPSTASH_REDIS_REST_URL || null;   // safe to show
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || null; // mask in output

  const mask = (s) => (s ? s.slice(0, 8) + "…" + s.slice(-4) : null);

  res.status(200).json({
    ok: true,
    hasUrl: Boolean(url),
    hasToken: Boolean(token),
    url,
    tokenMasked: mask(token),
    hint:
      "If both are true but Redis still 500s, redeploy from Vercel with Skip Build Cache."
  });
}
