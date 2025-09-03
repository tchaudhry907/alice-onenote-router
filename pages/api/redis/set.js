import { kv } from "@/lib/kv";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Use POST" });
  }

  try {
    const { key, value, ttl } = req.body;
    if (!key) return res.status(400).json({ ok: false, error: "Missing key" });

    if (ttl) {
      await kv.set(key, value, { ex: Number(ttl) });
    } else {
      await kv.set(key, value);
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
}
