const { kvGet } = require("../../../lib/kv");

export default async function handler(req, res) {
  const { key } = req.query;
  if (!key) return res.status(400).json({ ok: false, error: "Missing ?key" });

  try {
    const out = await kvGet(key);
    // Upstash returns { result: "value" } or { result: null }
    res.status(200).json({ ok: true, key, value: out?.result ?? null });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
