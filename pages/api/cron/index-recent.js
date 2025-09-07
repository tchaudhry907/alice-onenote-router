// /pages/api/cron/index-recent.js
// GET /api/cron/index-recent?limit=50&notebook=AliceChatGPT
// Indexes (caches) the HTML+text of the most-recent pages in a notebook.

import { graphFetch } from "@/lib/msgraph";
import { getAccessTokenFromCron, indexPage } from "@/lib/indexer";

export default async function handler(req, res) {
  try {
    const limit = clampInt(req.query.limit, 50, 1, 200);
    const notebookName = (req.query.notebook || "AliceChatGPT").toString();

    const base = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`;
    const nbUrl = new URL(`${base}/api/onenote/sections-in-onenote`);
    nbUrl.searchParams.set("name", notebookName);
    let nbRes = await fetch(nbUrl.toString());
    let nbJson = await safeJson(await nbRes.text());

    // Fallback to alias path if necessary
    if (!nbRes.ok || !nbJson || !nbJson.ok) {
      const alt = new URL(`${base}/api/onenote/sections-in-notebook`);
      alt.searchParams.set("name", notebookName);
      nbRes = await fetch(alt.toString());
      nbJson = await safeJson(await nbRes.text());
    }
    if (!nbRes.ok || !nbJson || !nbJson.ok) {
      return res.status(502).json({ ok: false, error: "Resolve notebook failed for indexing" });
    }
    const allowSectionIds = new Set((nbJson.sections || []).map(s => s.id));
    const access_token = await getAccessTokenFromCron();

    // Fetch recent pages
    const pagesUrl = "https://graph.microsoft.com/v1.0/me/onenote/pages"
      + "?$top=200&$orderby=createdDateTime desc"
      + "&$select=id,title,createdDateTime,lastModifiedDateTime"
      + "&$expand=parentSection($select=id,displayName)";
    const pr = await graphFetch(access_token, pagesUrl);
    const pJson = await safeJson(await pr.text());
    if (!pr.ok || !pJson) {
      return res.status(502).json({ ok: false, error: "Pages fetch failed for indexing" });
    }

    const items = (pJson.value || []).filter(p => allowSectionIds.has(p.parentSection?.id)).slice(0, limit);
    const results = [];
    for (const p of items) {
      try {
        await indexPage(access_token, p.id);
        results.push({ id: p.id, title: p.title, ok: true });
      } catch (e) {
        results.push({ id: p.id, title: p.title, ok: false, error: String(e?.message || e) });
      }
    }
    return res.status(200).json({ ok: true, indexed: results.length, results });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

function clampInt(v, def, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}
async function safeJson(t) { try { return JSON.parse(t); } catch { return null; } }
