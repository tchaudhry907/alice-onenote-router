// pages/api/graph/page-create-by-name.js
// Creates a OneNote page in a section resolved by notebook+section names,
// using the XHTML create endpoint with the "onenote-section-id" header.
// Usage (GET for convenience):
//   /api/graph/page-create-by-name?notebook=AliceChatGPT&section=Inbox
//     &title=Hello&body=Created%20via%20XHTML
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

    let r = await fetch(nbUrl.toString(), {
      headers: { Authorization: `Bearer ${decodeURIComponent(token)}` },
    });
    let j = await r.json();
    if (!r.ok) return res.status(r.status).json(j);

    const nb = (j.value || []).find(
      n => (n.displayName || "").toLowerCase() === notebook.toLowerCase()
    );
    if (!nb) return res.status(404).json({ error: `Notebook not found: ${notebook}` });

    // 2) Resolve section by name
    const secUrl = new URL(
      `https://graph.microsoft.com/v1.0/me/onenote/notebooks/${encodeURIComponent(nb.id)}/sections`
    );
    secUrl.searchParams.set("$select", "id,displayName");

    r = await fetch(secUrl.toString(), {
      headers: { Authorization: `Bearer ${decodeURIComponent(token)}` },
    });
    j = await r.json();
    if (!r.ok) return res.status(r.status).json(j);

    const sec = (j.value || []).find(
      s => (s.displayName || "").toLowerCase() === section.toLowerCase()
    );
    if (!sec) return res.status(404).json({ error: `Section not found: ${section}` });

    // 3) Build XHTML body
    const xhtml =
`<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en-US">
  <head>
    <title>${escapeXml(title)}</title>
    <meta name="created" content="${new Date().toISOString()}" />
  </head>
  <body>
    <p>${escapeXml(body)}</p>
  </body>
</html>`;

    // 4) POST create page (XHTML + onenote-section-id header)
    r = await fetch("https://graph.microsoft.com/v1.0/me/onenote/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${decodeURIComponent(token)}`,
        "Content-Type": "application/xhtml+xml",
        Accept: "application/json",
        "onenote-section-id": sec.id, // critical: place into specific section
      },
      body: xhtml,
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

function escapeXml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
