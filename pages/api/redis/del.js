import { kv } from "@/lib/kv";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Use POST" });
  }
  try {
    const { key } = await req.body || {};
    if (!key) return res.status(400).json({ ok: false, error: "Missing key" });

    const removed = await kv.del(key); // 1 if deleted, 0 if not found
    res.status(200).json({ ok: true, key, removed });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
}
