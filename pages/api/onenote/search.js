// /pages/api/onenote/search.js
// Deep search inside the AliceChatGPT notebook.
// POST { q: string, limit?: number, notebook?: string, deep?: boolean, deepLimit?: number }

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
    if (!savedRefresh) return res.status(400).json({ ok: false, error: "Not bound. Visit /api/cron/bind while signed in." });
    const { access_token } = await exchangeRefreshToken(savedRefresh);

    // inputs
    const body = (req.body && typeof req.body === "object") ? req.body : {};
    const q = (typeof body.q === "string" ? body.q : "").trim();
    const limit = clampInt(body.limit, 10, 1, 50);
    const notebookName = (body.notebook || "AliceChatGPT").toString();
    const deep = body.deep === undefined ? true : !!body.deep;     // default deep = true
    const deepLimit = clampInt(body.deepLimit, 20, 1, 40);

    // 1) Resolve notebook sections via our own API — try BOTH paths to avoid 404 drift
    const base = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`;
    const sections = await resolveSections(base, notebookName);
    if (!sections.ok) {
      return res.status(502).json({ ok: false, error: "Resolve notebook failed", detail: sections.detail });
    }
    const allowSectionIds = new Set((sections.sections || []).map(s => s.id));

    // 2) Pull recent pages (ask for parentSection to filter by notebook)
    const pagesUrl = "https://graph.microsoft.com/v1.0/me/onenote/pages"
      + "?$top=100&$orderby=createdDateTime desc"
      + "&$select=id,title,createdDateTime,lastModifiedDateTime,links"
      + "&$expand=parentSection($select=id,displayName)";

    const pr = await graphFetch(access_token, pagesUrl);
    const pText = await pr.text();
    const pJson = safeJson(pText);
    if (!pr.ok || !pJson) {
      return res.status(502).json({ ok: false, error: "Pages fetch failed", detail: { status: pr.status, body: truncate(pText, 400) } });
    }

    const items = Array.isArray(pJson.value) ? pJson.value : [];
    const fromNotebook = items.filter(p => allowSectionIds.has(p.parentSection?.id));

    // Title filter first
    let results = q
      ? fromNotebook.filter(p => (p.title || "").toLowerCase().includes(q.toLowerCase()))
      : fromNotebook.slice(0, limit);

    let out = results.slice(0, limit).map(toResult);

    // Deep content scan (optional, only if q provided)
    if (q && deep) {
      const scanPool = fromNotebook.slice(0, Math.max(limit, deepLimit));
      const qLower = q.toLowerCase();
      const deepMatches = [];
      for (const p of scanPool) {
        try {
          const contentUrl = `https://graph.microsoft.com/v1.0/me/onenote/pages/${encodeURIComponent(p.id)}/content`;
          const cr = await graphFetch(access_token, contentUrl);
          const html = await cr.text();
          if (cr.ok && html && html.toLowerCase().includes(qLower)) {
            deepMatches.push(p);
          }
        } catch {
          // ignore single-page failures
        }
        if (deepMatches.length >= deepLimit) break;
      }
      const have = new Set(out.map(r => r.id));
      for (const p of deepMatches) {
        if (!have.has(p.id)) out.push(toResult(p));
        if (out.length >= limit) break;
      }
    }

    return res.status(200).json({ ok: true, notebook: notebookName, deepUsed: !!(q && deep), count: out.length, results: out });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

// ---- helpers ----
async function resolveSections(base, notebookName) {
  // Try /sections-in-onenote
  const try1 = new URL(`${base}/api/onenote/sections-in-onenote`);
  try1.searchParams.set("name", notebookName);
  const r1 = await fetch(try1.toString());
  const t1 = await r1.text();
  const j1 = safeJson(t1);
  if (r1.ok && j1 && j1.ok && Array.isArray(j1.sections)) {
    return { ok: true, sections: j1.sections };
  }

  // If 404 or failed, try /sections-in-notebook (alias)
  const try2 = new URL(`${base}/api/onenote/sections-in-notebook`);
  try2.searchParams.set("name", notebookName);
  const r2 = await fetch(try2.toString());
  const t2 = await r2.text();
  const j2 = safeJson(t2);
  if (r2.ok && j2 && j2.ok && Array.isArray(j2.sections)) {
    return { ok: true, sections: j2.sections };
  }

  // Return the best debug we have
  return {
    ok: false,
    detail: {
      first: { status: r1.status, body: truncate(t1, 300) },
      second: { status: r2.status, body: truncate(t2, 300) }
    }
  };
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
