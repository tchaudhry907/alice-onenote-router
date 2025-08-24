// pages/api/me.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  const token = req.cookies?.graph_access_token;
  if (!token) return res.status(401).json({ error: "No access token. Please sign in at /login." });

  try {
    const r = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const j = await r.json();
    return res.status(r.ok ? 200 : 500).json(j);
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
}
