// /pages/api/onenote/sections.js
// Lists your OneNote sections with IDs and names so you can set DEFAULT_SECTION_ID correctly.

import { kv } from "@/lib/kv";
import { exchangeRefreshToken, graphFetch } from "@/lib/msgraph";

export default async function handler(req, res) {
  try {
    const savedRefresh = await kv.get("alice:cron:refresh");
    if (!savedRefresh) {
      return res.status(400).json({ ok: false, error: "Not bound. Visit /api/cron/bind once while signed in." });
    }
    const { access_token } = await exchangeRefreshToken(savedRefresh);

    // Grab first 100 sections (adjust if you have many)
    const url = "https://graph.microsoft.com/v1.0/me/onenote/sections?$top=100&$select=id,displayName";
    const r = await graphFetch(access_token, url);
    const t = await r.text();
    let j = null; try { j = JSON.parse(t); } catch {}
    if (!r.ok) return res.status(r.status).send(j || t);

    const sections = (j.value || []).map(s => ({ id: s.id, name: s.displayName }));
    return res.status(200).json({ ok: true, count: sections.length, sections });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
