// pages/api/redis/kv.ts
export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    route: "/api/redis/kv",
    note: "minimal test handler (no Redis yet)"
  });
}
