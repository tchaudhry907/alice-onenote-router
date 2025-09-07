// /pages/api/onenote/log.js
// Daily append: POST { text: "..." } -> creates/gets today's page and appends the entry.
// Uses the saved refresh token from KV (set by /api/cron/bind). No browser session required.

import { kv } from "@/lib/kv";
import { exchangeRefreshToken, graphFetch } from "@/lib/msgraph";

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Use POST with JSON { text }" });
  }

  try {
    const sectionId = process.env.DEFAULT_SECTION_ID;
    if (!sectionId) return res.status(500).json({ ok: false, error: "DEFAULT_SECTION_ID not set" });

    const body = (req.body && typeof req.body === "object") ? req.body : {};
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) return res.status(400).json({ ok: false, error: "Missing 'text' string in body" });

    // Get access token from saved refresh token (set by /api/cron/bind)
    const savedRefresh = await kv.get("alice:cron:refresh");
    if (!savedRefresh) {
      return res.status(400).json({ ok: false, error: "Not bound. Visit /api/cron/bind once while signed in." });
    }
    const { access_token } = await exchangeRefreshToken(savedRefresh);

    // Compute today's key (UTC)
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(now.getUTCDate()).padStart(2, "0");
    const dateKey = `${yyyy}-${mm}-${dd}`;
    const pageTitle = `Daily Log — ${dateKey}`;

    // Find or create today's page (cached in KV)
    const kvKey = `alice:daily:${dateKey}`;
    let pageId = await kv.get(kvKey);

    if (!pageId) {
      // Create a new page for today
      const headerHtml =
        `<!DOCTYPE html><html><head><title>${esc(pageTitle)}</title></head>` +
        `<body><h2>${esc(pageTitle)}</h2><p style="color:#666;font-size:12px">Created by Alice Router</p></body></html>`;

      const createUrl = `https://graph.microsoft.com/v1.0/me/onenote/sections/${encodeURIComponent(sectionId)}/pages`;
      const createRes = await graphFetch(access_token, createUrl, {
        method: "POST",
        headers: { "Content-Type": "application/xhtml+xml" },
        body: headerHtml,
      });
      const createText = await createRes.text();
      let createJson = null; try { createJson = JSON.parse(createText); } catch {}
      if (!createRes.ok) return res.status(createRes.status).send(createJson || createText);
      pageId = createJson?.id;
      if (!pageId) return res.status(500).json({ ok: false, error: "Page created but id missing" });

      // Cache today’s page id for 36h
      await kv.set(kvKey, pageId, { ex: 60 * 60 * 36 });
    }

    // Prepare the appended entry (timestamp + escaped text with line breaks)
    const ts = now.toISOString().replace("T", " ").replace("Z", " UTC");
    const htmlChunk = `<p><b>${esc(ts)}</b> — ${nl2br(esc(text))}</p>`;

    // OneNote append via PATCH commands
    const patchUrl = `https://graph.microsoft.com/v1.0/me/onenote/pages/${encodeURIComponent(pageId)}/content`;
    const commands = [
      { target: "body", action: "append", content: htmlChunk }
    ];

    const patchRes = await graphFetch(access_token, patchUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(commands),
    });

    if (!patchRes.ok) {
      const t = await patchRes.text();
      return res.status(patchRes.status).send({ ok: false, error: t });
    }

    return res.status(200).json({ ok: true, pageId, title: pageTitle });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

// Helpers
function esc(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function nl2br(s) { return s.replace(/\r\n|\n\r|\r|\n/g, "<br/>"); }
