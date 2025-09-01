// pages/api/graph/create-page.js
export default async function handler(req, res) {
  try {
    const token = req.cookies?.access_token;
    const sectionId = req.query.sectionId;
    const title = req.query.title || "Alice Router Test";
    const body = req.query.body || "Hello from the router!";

    if (!token) return res.status(401).json({ error: "No access_token cookie" });
    if (!sectionId) return res.status(400).json({ error: "Missing sectionId" });

    // OneNote page create requires XHTML payload
    const html =
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

    const r = await fetch("https://graph.microsoft.com/v1.0/me/onenote/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/xhtml+xml",
        "Accept": "application/json",
        "onenote-section-id": sectionId, // directs the new page to this section
      },
      body: html,
    });

    const j = await r.json();
    if (!r.ok) return res.status(r.status).json(j);

    return res.status(201).json({
      created: {
        id: j.id,
        title: j.title,
        createdDateTime: j.createdDateTime,
        links: j.links, // may include webUrl/oneNoteClientUrl
      },
      raw: j,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// tiny helper
function escapeXml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
