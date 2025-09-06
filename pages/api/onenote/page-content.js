// pages/api/onenote/page-content.js
// Returns the OneNote page HTML (proxied) for a given ?id=<PAGE_ID>

import { requireAuth } from "@/lib/auth";
import { graphFetch } from "@/lib/msgraph";

export default async function handler(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  const id = req.query.id;
  if (!id || typeof id !== "string") {
    return res.status(400).json({ ok: false, error: "Missing id" });
  }

  try {
    const url = `https://graph.microsoft.com/v1.0/me/onenote/pages/${encodeURIComponent(id)}/content`;
    const r = await graphFetch(auth.accessToken, url, { method: "GET" });
    const html = await r.text();

    if (!r.ok) {
      return res.status(r.status).json({ ok: false, error: html });
    }

    // Return as HTML page (so you can open it in a tab), not JSON
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.status(200).send(html);
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
