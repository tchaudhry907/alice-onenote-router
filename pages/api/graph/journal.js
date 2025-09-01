// pages/api/graph/journal.js
// Drops a page into your default Journal section (Inbox in AliceChatGPT).
// Uses the reliable section endpoint (multipart) so it CANNOT detour to Quick Notes.
//
// Usage (GET for convenience in browser):
//   /api/graph/journal?title=My%20Entry&body=Hello%20world
// If title is omitted, it defaults to ISO date (e.g., 2025-09-01).
//
// Configuration:
// - Prefer setting env var DEFAULT_SECTION_ID to your Inbox section id.
// - Fallback: uses the known Inbox id for your account.
//
// Response: { created: { id, title, createdDateTime, link }, raw }

const FALLBACK_SECTION_ID = "0-824A10198D31C608!scfd7de0686df4aa1bc663dd4e7769585"; // Inbox (AliceChatGPT)

export default async function handler(req, res) {
  try {
    const token = req.cookies?.access_token;
    if (!token) return res.status(401).json({ error: "No access_token cookie. Visit /api/auth/login first." });

    const sectionId = (process.env.DEFAULT_SECTION_ID || FALLBACK_SECTION_ID).trim();
    if (!sectionId) return res.status(500).json({ error: "Missing DEFAULT_SECTION_ID and fallback." });

    const title = cleanStr(req.query.title) || todayISO();
    const body  = cleanStr(req.query.body)  || "—";

    // Proper multipart body with CRLF and Presentation part
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
  const d = new Date();
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}
function cleanStr(x) {
  if (x == null) return "";
  return String(x).trim();
}
function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
