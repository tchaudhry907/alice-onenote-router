import { kv } from "@/lib/kv";

export default async function handler(req, res) {
  const { key } = req.query;
  if (!key) return res.status(400).json({ ok: false, error: "Missing ?key" });

  try {
    const value = await kv.get(key);
    res.status(200).json({ ok: true, key, value });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
}
