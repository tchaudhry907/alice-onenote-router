const { kvPing } = require("../../../lib/kv");

export default async function handler(req, res) {
  try {
    const pong = await kvPing();
    res.status(200).json({ ok: true, pong, when: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
