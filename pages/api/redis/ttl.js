// pages/api/redis/ttl.js
import { kv } from "@/lib/kv";

export default async function handler(req, res) {
  try {
    const key = req.query.key || req.body?.key;
    if (!key) return res.status(400).json({ ok: false, error: "Missing ?key=" });
    const ttl = await kv.ttl(key); // seconds (-1 = no expire, -2 = missing)
    res.status(200).json({ ok: true, key, ttl });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
