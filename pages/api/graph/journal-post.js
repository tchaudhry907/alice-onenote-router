// pages/api/graph/journal-post.js
// POST a long diary/body safely into AliceChatGPT → Inbox.
// Body: JSON { "title": "optional", "body": "required (string)" }
// If title is missing, today's YYYY-MM-DD is used.
// Uses sections/{id}/pages (multipart) so it always lands in Inbox.

const FALLBACK_SECTION_ID = "0-824A10198D31C608!scfd7de0686df4aa1bc663dd4e7769585"; // Inbox

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed. Use POST." });
    }

    const token = req.cookies?.access_token;
    if (!token) return res.status(401).json({ error: "No access_token cookie. Visit /api/auth/login first." });

    const sectionId = (process.env.DEFAULT_SECTION_ID || FALLBACK_SECTION_ID).trim();
    if (!sectionId) return res.status(500).json({ error: "Missing DEFAULT_SECTION_ID and fallback." });

    let data = {};
    try { data = JSON.parse(req.body || "{}"); } catch { /* if body already parsed by framework */ data = req.body || {}; }

    const title = cleanStr(data.title) || todayISO();
    const body  = cleanStr(data.body);
    if (!body) return res.status(400).json({ error: "Missing `body` in JSON." });

    const boundary = "----alice_router_" + Math.random().toString(36).slice(2);
    const html =
`<!DOCTYPE html>
<html>
  <head><title>${escapeHtml(title)}</title></head>
  <body>
    <p>${escapeHtml(body)}</p>
  </body>
</html>`;

    const multipart =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="Presentation"\r\n` +
      `Content-Type: text/html; charset=utf-8\r\n\r\n` +
      html + `\r\n` +
      `--${boundary}--\r\n`;

    const url = `https://graph.microsoft.com/v1.0/me/onenote/sections/${encodeURIComponent(sectionId)}/pages`;
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${decodeURIComponent(token)}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        Accept: "application/json",
      },
      body: multipart,
    });

    const j = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: "Create failed", details: j });

    return res.status(201).json({
      created: {
        id: j.id,
        title: j.title,
        createdDateTime: j.createdDateTime,
        link: j?.links?.oneNoteClientUrl?.href || null,
      },
      raw: j,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function cleanStr(x) { return x == null ? "" : String(x); }
function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
