// pages/api/session.js
// Build-safe stub: no imports.
export default async function handler(req, res) {
  return res.status(200).json({ ok: true, user: null, note: "session stub (no KV)" });
}
