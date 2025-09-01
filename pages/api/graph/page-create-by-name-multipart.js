// pages/api/graph/page-create-by-name-multipart.js
// Creates a OneNote page in a section resolved by notebook+section names,
// using the reliable endpoint: POST /me/onenote/sections/{id}/pages (multipart).
//
// Usage (GET for convenience in browser; handler does POST to Graph):
//   /api/graph/page-create-by-name-multipart?notebook=AliceChatGPT&section=Inbox
//     &title=Hello&body=Created%20via%20multipart
//
// Returns: { created: { id, title, section, notebook, createdDateTime, link }, raw }

export default async function handler(req, res) {
  try {
    const token = req.cookies?.access_token;
    if (!token) return res.status(401).json({ error: "No access_token cookie" });

    const notebook = String(req.query.notebook || "").trim();
    const section  = String(req.query.section  || "").trim();
    const title    = String(req.query.title    || "Untitled from Router");
    const body     = String(req.query.body     || "No content provided");

    if (!notebook || !section) {
      return res.status(400).json({ error: "Missing ?notebook=...&section=..." });
    }

    // 1) Resolve notebook by name
    const nbUrl = new URL("https://graph.microsoft.com/v1.0/me/onenote/notebooks");
    nbUrl.searchParams.set("$top", "100");
    nbUrl.searchParams.set("$select", "id,displayName");

    let r = await fetch(nbUrl.toString(), { headers: { Authorization: `Bearer ${decodeURIComponent(token)}` } });
    let j = await r.json();
    if (!r.ok) return res.status(r.status).json(j);

    const nb = (j.value || []).find(n => (n.displayName || "").toLowerCase() === notebook.toLowerCase());
    if (!nb) return res.status(404).json({ error: `Notebook not found: ${notebook}` });

    // 2) Resolve section by name
    const secUrl = new URL(`https://graph.microsoft.com/v1.0/me/onenote/notebooks/${encodeURIComponent(nb.id)}/sections`);
    secUrl.searchParams.set("$select", "id,displayName");

    r = await fetch(secUrl.toString(), { headers: { Authorization: `Bearer ${decodeURIComponent(token)}` } });
    j = await r.json();
    if (!r.ok) return res.status(r.status).json(j);

    const sec = (j.value || []).find(s => (s.displayName || "").toLowerCase() === section.toLowerCase());
    if (!sec) return res.status(404).json({ error: `Section not found: ${section}` });

    // 3) Build multipart body ("Presentation" part must be text/html)
    const boundary = "====alice_router_" + Math.random().toString(36).slice(2);
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
      `Content-Type: text/html\r\n\r\n` +
      html + `\r\n` +
      `--${boundary}--`;

    // 4) POST to sections/{id}/pages (most reliable placement)
    const createUrl = `https://graph.microsoft.com/v1.0/me/onenote/sections/${encodeURIComponent(sec.id)}/pages`;
    r = await fetch(createUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${decodeURIComponent(token)}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        Accept: "application/json",
      },
      body: multipart,
    });

    const created = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: "Create failed", details: created });

    return res.status(201).json({
      created: {
        id: created.id,
        title: created.title,
        section: sec.displayName,
        notebook: nb.displayName,
        createdDateTime: created.createdDateTime,
        link: created?.links?.oneNoteClientUrl?.href || null,
      },
      raw: created,
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
