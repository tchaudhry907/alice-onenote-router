// pages/api/redis/set.js
import { kv } from "@/lib/kv";

export default async function handler(req, res) {
  try {
    const key = req.query.key || req.body?.key;
    const value = (req.query.value ?? req.body?.value);
    const ttl = req.query.ttl ? Number(req.query.ttl) : (req.body?.ttl != null ? Number(req.body.ttl) : undefined);

    if (!key) return res.status(400).json({ ok: false, error: "Missing key" });
    if (value === undefined) return res.status(400).json({ ok: false, error: "Missing value" });

    if (Number.isFinite(ttl) && ttl > 0) {
      await kv.set(key, value, { ex: ttl });
    } else {
      await kv.set(key, value);
    }

    const ttlNow = await kv.ttl(key); // seconds (-1 no expire, -2 missing)
    res.status(200).json({ ok: true, key, value, ttl: ttlNow });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
