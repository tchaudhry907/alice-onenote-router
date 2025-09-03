import { kv } from "@/lib/kv";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Use POST" });
  }
  try {
    const { key, seconds } = await req.body || {};
    if (!key) return res.status(400).json({ ok: false, error: "Missing key" });
    if (seconds == null) return res.status(400).json({ ok: false, error: "Missing seconds" });

    const ok = await kv.expire(key, Number(seconds)); // true if TTL set
    res.status(200).json({ ok: true, key, seconds: Number(seconds), applied: ok });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
}
