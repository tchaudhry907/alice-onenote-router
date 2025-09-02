// pages/api/redis/kv.js
export default async function handler(req, res) {
  // Minimal, dependency-free handler so Vercel definitely picks it up
  res.status(200).json({
    ok: true,
    route: "/api/redis/kv",
    method: req.method,
    ts: new Date().toISOString(),
  });
}
