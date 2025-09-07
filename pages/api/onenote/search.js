// /pages/api/onenote/search.js
// POST { q?: string, limit?: number, notebook?: string } -> pages within that notebook (default: AliceChatGPT)
// Uses OneNote $search and filters results to the notebook's section IDs.

import { kv } from "@/lib/kv";
import { exchangeRefreshToken, graphFetch } from "@/lib/msgraph";

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Use POST with JSON { q? , limit? , notebook? }" });
  }

  try {
    const savedRefresh = await kv.get("alice:cron:refresh");
    if (!savedRefresh) return res.status(400).json({ ok: false, error: "Not bound. Visit /api/cron/bind while signed in." });
    const { access_token } = await exchangeRefreshToken(savedRefresh);

    const body = (req.body && typeof req.body === "object") ? req.body : {};
    const q = typeof body.q === "string" ? body.q.trim() : "";
    const limit = Number.isFinite(body.limit) ? Math.min(Math.max(1, body.limit), 50) : 20;
    const notebookName = (body.notebook || "AliceChatGPT").toString();

    // Resolve notebook/sections (cached)
    const nbUrl = new URL(`${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}/api/onenote/sections-in-notebook`);
    nbUrl.searchParams.set("name", notebookName);
    const nbRes = await fetch(nbUrl.toString());
    const nbJson = await nbRes.json();
    if (!nbJson.ok) return res.status(400).json({ ok: false, error: `Resolve notebook failed: ${nbJson.error || nbRes.status}` });
    const allowSectionIds = new Set((nbJson.sections || []).map(s => s.id));

    // Global OneNote search, then filter to allowed sections
    // Ask Graph for parentSection via $expand so we can filter.
    const base = `https://graph.microsoft.com/v1.0/me/onenote/pages?$top=50&$orderby=createdDateTime desc&$select=id,title,createdDateTime,lastModifiedDateTime,links`;
    const url = q
      ? `${base}&$search=${encodeURIComponent('"' + q.replace(/"/g, '\\"') + '"')}&$expand=parentSection($select=id,displayName)`
      : `${base}&$expand=parentSection($select=id,displayName)`;

    const r = await graphFetch(access_token, url);
    const t = await r.text();
    let j = null; try { j = JSON.parse(t); } catch {}
    if (!r.ok) return res.status(r.status).send(j || t);

    const items = Array.isArray(j.value) ? j.value : [];
    const filtered = items.filter(p => {
      const ps = p.parentSection || {};
      return ps.id && allowSectionIds.has(ps.id);
    }).slice(0, limit);

    const results = filtered.map(p => ({
      id: p.id,
      title: p.title,
      created: p.createdDateTime,
      modified: p.lastModifiedDateTime,
      section: p.parentSection?.displayName || null,
      links: p.links || {}
    }));

    return res.status(200).json({ ok: true, count: results.length, results, notebook: notebookName });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
