// pages/api/session.js
// KV_FREE: temporary stub for build unblocking. No imports at all.

export default async function handler(req, res) {
  return res.status(200).json({ ok: true, user: null, note: "session stub (no KV)" });
}
