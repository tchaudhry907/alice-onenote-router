// /pages/api/onenote/log.js
// POST { text: string, sectionId?: string }
// Appends to today's "Daily Log — YYYY-MM-DD" page (creates if needed).
// After successful write, it indexes (caches) the page content for fast future search.

import { kv } from "@/lib/kv";
import { exchangeRefreshToken, graphFetch } from "@/lib/msgraph";
import { indexPage } from "@/lib/indexer";

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Use POST with JSON { text, sectionId? }" });
  }

  try {
    const body = (req.body && typeof req.body === "object") ? req.body : {};
    const text = (body.text || "").toString().trim();
    if (!text) return res.status(400).json({ ok: false, error: "Missing text" });

    // Auth via refresh
    const savedRefresh = await kv.get("alice:cron:refresh");
    if (!savedRefresh) return res.status(400).json({ ok: false, error: "Not bound. Visit /api/cron/bind while signed in." });
    const { access_token } = await exchangeRefreshToken(savedRefresh);

    // Resolve sectionId: provided or default
    let sectionId = body.sectionId;
    if (!sectionId) {
      const defaultId = await kv.get("DEFAULT_SECTION_ID");
      sectionId = defaultId || process.env.DEFAULT_SECTION_ID || null;
    }
    if (!sectionId) return res.status(400).json({ ok: false, error: "No sectionId. Pass sectionId or set DEFAULT_SECTION_ID." });

    // Find/create today's page in section
    const todayTitle = `Daily Log — ${new Date().toISOString().slice(0,10)}`;

    // Try to find a page with today's title in this section
    // (Graph lacks direct filter here; we list a few recent pages in the section)
    const pagesUrl = `https://graph.microsoft.com/v1.0/me/onenote/sections/${encodeURIComponent(sectionId)}/pages?$top=20&$orderby=createdDateTime desc&$select=id,title,createdDateTime`;
    let pr = await graphFetch(access_token, pagesUrl);
    let pJson = safeJson(await pr.text());
    if (!pr.ok || !pJson) return res.status(502).json({ ok: false, error: "List section pages failed" });

    let page = (pJson.value || []).find(p => (p.title || "").trim() === todayTitle);

    // Create if missing
    if (!page) {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>${escapeHtml(todayTitle)}</title></head>
          <body>
            <p>Created: ${new Date().toLocaleString()}</p>
            <hr/>
          </body>
        </html>`;
      const createUrl = `https://graph.microsoft.com/v1.0/me/onenote/sections/${encodeURIComponent(sectionId)}/pages`;
      const cr = await fetch(createUrl, {
        method: "POST",
        headers: { "Authorization": `Bearer ${access_token}`, "Content-Type": "text/html" },
        body: html
      });
      const cText = await cr.text();
      const cJson = safeJson(cText);
      if (!cr.ok || !cJson?.id) {
        return res.status(502).json({ ok: false, error: "Create page failed", detail: { status: cr.status, body: cText.slice(0, 400) } });
      }
      page = cJson;
    }

    // Append text as a new paragraph
    const appendUrl = `https://graph.microsoft.com/v1.0/me/onenote/pages/${encodeURIComponent(page.id)}/content`;
    const appendHtml = `
      <html>
        <body>
          <p>${escapeHtml(text)} <span style="color:#777;font-size:10px;">(${new Date().toLocaleString()})</span></p>
        </body>
      </html>`;
    const ar = await fetch(appendUrl, {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${access_token}`, "Content-Type": "application/xhtml+xml" },
      body: appendHtml
    });
    if (!ar.ok) {
      const aText = await ar.text();
      return res.status(502).json({ ok: false, error: "Append failed", detail: { status: ar.status, body: aText.slice(0, 400) } });
    }

    // Refresh the cache for this page so searches see it immediately
    try { await indexPage(access_token, page.id); } catch {}

    return res.status(200).json({ ok: true, pageId: page.id, title: todayTitle, sectionIdUsed: sectionId });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

function safeJson(t) { try { return JSON.parse(t); } catch { return null; } }
function escapeHtml(s) {
  return (s || "").toString()
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
