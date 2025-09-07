// /pages/api/onenote/search.js
// Deep search that first consults Redis cache (fast), and only hits Graph for cache misses.

import { kv } from "@/lib/kv";
import { exchangeRefreshToken, graphFetch } from "@/lib/msgraph";
import { getCachedText, indexPage } from "@/lib/indexer";

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

    const body = (req.body && typeof req.body === "object") ? req.body : {};
    const q = (typeof body.q === "string" ? body.q : "").trim();
    const limit = clampInt(body.limit, 10, 1, 50);
    const notebookName = (body.notebook || "AliceChatGPT").toString();
    const deep = body.deep === undefined ? true : !!body.deep;          // deep search enabled by default
    const deepLimit = clampInt(body.deepLimit, 20, 1, 40);              // max #cache-miss pages we’ll fetch+index

    // 1) Resolve notebook sections (try both helper routes to avoid 404)
    const base = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`;
    const sections = await resolveSections(base, notebookName);
    if (!sections.ok) return res.status(502).json({ ok: false, error: "Resolve notebook failed", detail: sections.detail });
    const allowSectionIds = new Set((sections.sections || []).map(s => s.id));

    // 2) Fetch recent pages (no $search)
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
    const items = (pJson.value || []).filter(p => allowSectionIds.has(p.parentSection?.id));

    // 3) Title match
    let prelim = q
      ? items.filter(p => (p.title || "").toLowerCase().includes(q.toLowerCase()))
      : items.slice(0, limit);

    // 4) Build initial result list
    let out = prelim.slice(0, limit).map(toResult);

    // 5) Deep content search using CACHE first (only if q provided)
    if (q && deep) {
      const qLower = q.toLowerCase();
      const pool = items.slice(0, Math.max(limit, deepLimit));
      const have = new Set(out.map(r => r.id));
      const misses = [];

      // Check cache
      for (const p of pool) {
        if (out.length >= limit) break;
        try {
          const cached = await getCachedText(p.id);
          if (cached) {
            if (cached.toLowerCase().includes(qLower) && !have.has(p.id)) {
              out.push(toResult(p));
              have.add(p.id);
            }
          } else {
            misses.push(p);
          }
        } catch {
          misses.push(p);
        }
      }

      // Fill cache misses (up to deepLimit) by fetching + indexing
      for (const p of misses.slice(0, deepLimit)) {
        if (out.length >= limit) break;
        try {
          const { text } = await indexPage(access_token, p.id);
          if (text && text.toLowerCase().includes(qLower) && !have.has(p.id)) {
            out.push(toResult(p));
            have.add(p.id);
          }
        } catch {
          // ignore single-page failures
        }
      }
    }

    return res.status(200).json({ ok: true, notebook: notebookName, deepUsed: !!(q && deep), count: out.length, results: out });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

// ---- helpers ----
async function resolveSections(base, notebookName) {
  const try1 = new URL(`${base}/api/onenote/sections-in-onenote`);
  try1.searchParams.set("name", notebookName);
  let r = await fetch(try1.toString());
  let t = await r.text();
  let j = safeJson(t);
  if (r.ok && j && j.ok) return { ok: true, sections: j.sections };

  const try2 = new URL(`${base}/api/onenote/sections-in-notebook`);
  try2.searchParams.set("name", notebookName);
  r = await fetch(try2.toString());
  t = await r.text();
  j = safeJson(t);
  if (r.ok && j && j.ok) return { ok: true, sections: j.sections };

  return { ok: false, detail: { first: { status: r.status, body: truncate(t, 300) } } };
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
function safeJson(text) { try { return JSON.parse(text); } catch { return null; } }
function truncate(s, n) { return (typeof s === "string" && s.length > n) ? (s.slice(0, n) + "…") : s; }
