// pages/api/graph/me.js
import { getAccessToken } from "@/lib/auth";

export default async function handler(req, res) {
  try {
    const token = await getAccessToken(req); // should read from cookie, header, or env per your auth util
    if (!token) return res.status(401).json({ ok: false, error: "No access token" });

    const r = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await r.json();
    res.status(r.status).json(json);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
