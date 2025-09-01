// pages/api/graph/page-create-by-sectionid-multipart.js
// Forces creation into a specific section by POSTing to /me/onenote/sections/{id}/pages
// using proper multipart format (Presentation part).
//
// Usage (GET for convenience):
//   /api/graph/page-create-by-sectionid-multipart?sectionId=SECTION_ID
//     &title=Hello&body=Created%20via%20sections%7Bid%7D%2Fpages
//
// Returns: { created: { id, title, createdDateTime, link }, raw }

export default async function handler(req, res) {
  try {
    const token = req.cookies?.access_token;
    if (!token) return res.status(401).json({ error: "No access_token cookie" });

    const sectionId = String(req.query.sectionId || "").trim();
    const title = String(req.query.title || "Untitled from Router");
    const body  = String(req.query.body  || "No content provided");

    if (!sectionId) return res.status(400).json({ error: "Missing ?sectionId=..." });

    // Proper multipart with CRLF sequences and a unique boundary
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

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
