// pages/api/cron/health.js
export default async function handler(req, res) {
  return res.status(200).json({ ok: true, kv: "skipped", note: "health stub (no kv sdk)" });
}
