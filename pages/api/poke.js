// pages/api/poke.js
export default function handler(req, res) {
  res.status(200).json({ ok: true, where: "/api/poke", ts: new Date().toISOString() });
}
