// pages/api/cron/health.js
// KV_FREE: temporary stub for build unblocking. No imports at all.

export default async function handler(req, res) {
  return res.status(200).json({ ok: true, kv: "skipped", hasToken: null, note: "health stub (no KV)" });
}
