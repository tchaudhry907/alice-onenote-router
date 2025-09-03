import { kv } from "@/lib/kv";

export default async function handler(req, res) {
  try {
    const { key } = req.query;
    if (!key) return res.status(400).json({ ok: false, error: "Missing ?key" });

    const seconds = await kv.ttl(key); // -2 = no key, -1 = no expire, >=0 = secs left
    res.status(200).json({ ok: true, key, ttl: seconds });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
}
