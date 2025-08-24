// pages/api/debug/session.js
export default async function handler(req, res) {
  const raw = req.cookies?.session;
  let parsed = null;
  try { parsed = raw ? JSON.parse(raw) : null; } catch {}
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(200).send(JSON.stringify({ hasSession: !!raw, session: parsed }, null, 2));
}
