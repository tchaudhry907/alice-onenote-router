// /pages/api/onenote/search.js
// Deep search inside the AliceChatGPT notebook.
// POST { q: string, limit?: number, notebook?: string, deep?: boolean, deepLimit?: number }
// Defaults: notebook="AliceChatGPT", deep=true, limit=10, deepLimit=20 (max #pages whose HTML we scan)
//
// How it works:
// 1) Resolve notebook -> sections (cached by our own endpoint).
// 2) Pull recent pages (no $search to avoid OData issues).
// 3) Filter pages to that notebook's sections.
// 4) If q is present:
//    - fast filter by title
//    - if deep=true, fetch HTML for up to deepLimit recent pages and match q in content
//
// Notes:
// - Always returns JSON (never HTML), even on errors.
// - If Graph or an internal call returns HTML, we wrap that as a JSON error with status/text.

import { kv } from "@/lib/kv";
import { exchangeRefreshToken, graphFetch } from "@/lib/msgraph";

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Use POST with JSON { q, limit?, notebook?, deep?, deepLimit? }" });
  }

  try {
    const savedRefresh = await kv.get("alice:cron:refresh");
    if (!savedRefresh) {
      return res.status(400).json({ ok: false, error: "Not bound. Visit /api/cron/bind while signed in." });
    }
    const { access_token } = await exchangeRefreshToken(savedRefresh);

    // inputs
    const body = (req.body && typeof req.body === "object") ? req.body : {};
    const qRaw = typeof body.q === "string" ? body.q : "";
    const q = qRaw.trim();
    const limit = clampInt(body.limit, 10, 1, 50);
    const notebookName = (body.notebook || "AliceChatGPT").toString();
    const deep = body.deep === undefined ? true : !!body.deep; // default deep=true
    const deepLimit = clampInt(body.deepLimit, 20, 1, 40);     // cap to be nice to Graph

    // 1) Resolve notebook + sections (via our own API)
    const base = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`;
    const nbUrl = new URL(`${base}/api/onenote/sections-in-onenote`);
    nbUrl.searchParams.set("name", notebookName);
    const nbRes = await fetch(nbUrl.toString());
    const nbText = await nbRes.text();
    let nbJson = safeJson(nbText);
    if (!nbRes.ok || !nbJson || !nbJson.ok) {
      return res.status(502).json({
        ok: false,
        error: `Resolve notebook failed`,
        detail: {
          status: nbRes.status,
          body: truncate(nbText, 400)
        }
      });
    }
    const allowSectionIds = new Set((nbJson.sections || []).map(s => s.id));

    // 2) Get recent pages (ask parentSection to filter to notebook)
    // No $search here (OData errors), we do client-side filtering/deep scan
    const pagesUrl = `https://graph.microsoft.com/v1.0/me/onenote/pages` +
      `?$top=100&$orderby=createdDateTime desc` +
      `&$select=id,title,createdDateTime,lastModifiedDateTime,links` +
      `&$expand=parentSection($select=id,displayName)`;

    const pr = await graphFetch(access_token, pagesUrl);
    const pText = await pr.text();
    const pJson = safeJson(pText);
    if (!pr.ok || !pJson) {
      return res.status(502).json({
        ok: false,
        error: "Pages fetch failed",
        detail: { status: pr.status, body: truncate(pText, 400) }
      });
    }

    const items = Array.isArray(pJson.value) ? pJson.value : [];
    // 3) Filter only pages within our notebook sections
    let fromNotebook = items.filter(p => allowSectionIds.has(p.parentSection?.id));

    // 4) Title filter
    let results = [];
    if (q) {
      const qLower = q.toLowerCase();
      results = fromNotebook.filter(p => (p.title || "").toLowerCase().includes(qLower));
    } else {
      results = fromNotebook.slice(0, limit);
    }

    // Build result objects
    let out = results.slice(0, limit).map(toResult);

    // Deep content filter (optional & only if q present)
    if (q && deep) {
      const qLower = q.toLowerCase();

      // Choose which pages to scan (recent ones from this notebook)
      const scanPool = fromNotebook.slice(0, Math.max(limit, deepLimit));

      const deepMatches = [];
      for (const p of scanPool) {
        try {
          const contentUrl = `https://graph.microsoft.com/v1.0/me/onenote/pages/${encodeURIComponent(p.id)}/content`;
          const cr = await graphFetch(access_token, contentUrl);
          const html = await cr.text();
          if (cr.ok) {
            if (html && html.toLowerCase().includes(qLower)) {
              deepMatches.push(p);
            }
          } else {
            // Non-200—ignore but don't crash the endpoint
          }
        } catch {
          // Network or parse error—ignore for this page
        }
        if (deepMatches.length >= deepLimit) break;
      }

      // Merge: add any deep matches not already present
      const existing = new Set(out.map(r => r.id));
      for (const p of deepMatches) {
        if (!existing.has(p.id)) out.push(toResult(p));
        if (out.length >= limit) break;
      }
    }

    return res.status(200).json({
      ok: true,
      notebook: notebookName,
      deepUsed: !!(q && deep),
      count: out.length,
      results: out
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

// Helpers
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
function clampInt(v, def, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}
function safeJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}
function truncate(s, n) {
  if (typeof s !== "string") return s;
  return s.length <= n ? s : s.slice(0, n) + "…";
}
