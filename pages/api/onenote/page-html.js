// /pages/api/onenote/page-html.js
// GET ?id=<pageId> -> proxies the OneNote HTML content for that page (read-only)

import { kv } from "@/lib/kv";
import { exchangeRefreshToken, graphFetch } from "@/lib/msgraph";

export default async function handler(req, res) {
  try {
    const id = (req.query.id || "").toString();
    if (!id) return res.status(400).send("Missing id");

    const savedRefresh = await kv.get("alice:cron:refresh");
    if (!savedRefresh) return res.status(400).send("Not bound");
    const { access_token } = await exchangeRefreshToken(savedRefresh);

    const url = `https://graph.microsoft.com/v1.0/me/onenote/pages/${encodeURIComponent(id)}/content`;
    const r = await graphFetch(access_token, url);
    const html = await r.text();
    res.status(r.status);
    res.setHeader("Content-Type", r.ok ? "text/html; charset=utf-8" : "application/json");
    return res.send(html);
  } catch (e) {
    return res.status(500).send(String(e?.message || e));
  }
}
