const { kvSet } = require("../../../lib/kv");

export default async function handler(req, res) {
  // Accept querystring or JSON body
  const isPost = req.method === "POST";
  const key = isPost ? req.body?.key : req.query.key;
  const value = isPost ? req.body?.value : req.query.value;
  const ttl = isPost ? req.body?.ttl : req.query.ttl;

  if (!key || value === undefined) {
    return res.status(400).json({
      ok: false,
      error: "Missing 'key' and/or 'value'. Use ?key=...&value=... [&ttl=seconds] or POST JSON."
    });
  }

  const ttlSeconds = ttl ? Number(ttl) : undefined;
  if (ttl && Number.isNaN(ttlSeconds)) {
    return res.status(400).json({ ok: false, error: "Invalid ttl (must be number of seconds)" });
  }

  try {
    const out = await kvSet(key, String(value), ttlSeconds);
    res.status(200).json({ ok: true, key, value: String(value), ttl: ttlSeconds ?? null, upstash: out });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
