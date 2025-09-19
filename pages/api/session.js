// pages/api/session.js
export default async function handler(req, res) {
  return res.status(200).json({ ok: true, user: null, note: "session stub (no kv sdk)" });
}
