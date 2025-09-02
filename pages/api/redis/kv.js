// pages/api/redis/redis.ts
export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    route: "/api/redis/redis",
    note: "minimal test handler (no Redis yet)"
  });
}
