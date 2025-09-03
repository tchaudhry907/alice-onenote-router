// pages/api/onenote/page-content.js
import { getTokenCookie } from "@/lib/cookie";
import { kv } from "@/lib/kv";
import { refreshAccessToken } from "@/lib/graph";

export default async function handler(req, res) {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ ok: false, error: "Missing ?id=<pageId>" });

    const tok = getTokenCookie(req);
    if (!tok?.key) return res.status(401).json({ ok: false, error: "Not authenticated" });
    const refreshToken = await kv.get(tok.key);
    if (!refreshToken) return res.status(401).json({ ok: false, error: "Session expired. Sign in again." });

    const fresh = await refreshAccessToken(refreshToken);
    const url = `https://graph.microsoft.com/v1.0/me/onenote/pages/${encodeURIComponent(id)}/content?includeIDs=true`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${fresh.access_token}` } });
    const html = await r.text();

    res
      .status(r.status)
      .setHeader("Content-Type", r.headers.get("content-type") || "text/html; charset=utf-8")
      .send(html);
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
