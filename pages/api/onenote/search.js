// /pages/api/onenote/search.js
// POST { q?: string, limit?: number, notebook?: string, deep?: boolean, deepLimit?: number }
// - notebook defaults to "AliceChatGPT"
// - q filters by title (case-insensitive); if deep=true, also fetches HTML for up to deepLimit pages and searches content.
// - Returns pages only from the specified notebook's sections.

import { kv } from "@/lib/kv";
import { exchangeRefreshToken, graphFetch } from "@/lib/msgraph";

export const config = { api: { bodyParser: true, externalResolver: true } };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Use POST with JSON { q?, limit?, notebook?, deep?, deepLimit? }" });
  }

  try {
    const savedRefresh = await kv.get("alice:cron:refresh");
    if (!savedRefresh) return res.status(400).json({ ok: false, error: "Not bound. Visit /api/cron/bind while signed in." });
    const { access_token } = await exchangeRefreshToken(savedRefresh);

    const body = (req.body && typeof req.body === "object") ? req.body : {};
    const q = typeof body.q === "string" ? body.q.trim() : "";
    const limit = Number.isFinite(body.limit) ? Math.min(Math.max(1, body.limit), 50) : 20;
    const notebookName = (body.notebook || "AliceChatGPT").toString();
    const deep = !!body.deep;
    const deepLimit = Number.isFinite(body.deepLimit) ? Math.min(Math.max(1, body.deepLimit), 20) : 8; // keep this small

    // Resolve notebook/sections via our own API (cached)
    const base = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`;
    const nbUrl = new URL(`${base}/api/onenote/sections-in-onenote`);
    nbUrl.searchParams.set("name", notebookName);
    const nbRes = await fetch(nbUrl.toString());
    const nbJson = await nbRes.json();
    if (!nbJson.ok) return res.status(400).json({ ok: false, error: `Resolve notebook failed: ${nbJson.error || nbRes.status}` });
    const allowSectionIds = new Set((nbJson.sections || []).map(s => s.id));

    // Pull recent pages (no $search to avoid OData errors), request parentSection to filter by notebook
    const url = `https://graph.microsoft.com/v1.0/me/onenote/pages?$top=100&$orderby=createdDateTime desc&$select=id,title,createdDateTime,lastModifiedDateTime,links&$expand=parentSection($select=id,displayName)`;
    const r = await graphFetch(access_token, url);
    const t = await r.text();
    let j = null; try { j = JSON.parse(t); } catch {}
    if (!r.ok) return res.status(r.status).send(j || t);

    const items = Array.isArray(j.value) ? j.value : [];
    // Filter by notebook sections first
    let filtered = items.filter(p => allowSectionIds.has(p.parentSection?.id));

    // Title filter if q provided (case-insensitive)
    if (q) {
      const qLower = q.toLowerCase();
      filtered = filtered.filter(p => (p.title || "").toLowerCase().includes(qLower));
    }

    // Trim to requested limit (we may expand if deep adds matches)
    let results = filtered.slice(0, limit).map(toResult);

    // Optional deep search: fetch HTML for a few most recent pages from this notebook, and include those whose content contains q
    if (q && deep) {
      const toCheck = filtered.slice(0, Math.max(limit, deepLimit)); // check recent ones
      const contentMatches = [];
      for (const p of toCheck) {
        try {
          const contentUrl = `https://graph.microsoft.com/v1.0/me/onenote/pages/${encodeURIComponent(p.id)}/content`;
          const cr = await graphFetch(access_token, contentUrl);
          const html = await cr.text();
          if (cr.ok && html && html.toLowerCase().includes(q.toLowerCase())) {
            contentMatches.push(p.id);
          }
        } catch {}
        if (contentMatches.length >= deepLimit) break;
      }
      // Add any deep matches not already in the results (then cap to limit)
      const existing = new Set(results.map(r => r.id));
      for (const p of toCheck) {
        if (contentMatches.includes(p.id) && !existing.has(p.id)) {
          results.push(toResult(p));
        }
      }
      results = results.slice(0, limit);
    }

    return res.status(200).json({ ok: true, count: results.length, results, notebook: notebookName, deepUsed: !!deep });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

function toResult(p) {
  return {
    id: p.id,
    title: p.title,
    created: p.createdDateTime,
    modified: p.lastModifiedDateTime,
    section: p.parentSection?.displayName || null,
    links: p.links || {}
  };
}
