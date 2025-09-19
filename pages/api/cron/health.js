// pages/api/cron/health.js
// KV_FREE stub so build never touches @vercel/kv here (we can restore real KV later).

export default async function handler(req, res) {
  return res.status(200).json({ ok: true, kv: "skipped", hasToken: null, note: "health stub (no KV)" });
}
