// pages/api/session.js
// KV_FREE stub so build never touches @vercel/kv here (we can restore real KV later).

export default async function handler(req, res) {
  return res.status(200).json({ ok: true, user: null, note: "session stub (no KV)" });
}
