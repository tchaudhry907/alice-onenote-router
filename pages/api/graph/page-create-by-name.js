// pages/api/graph/page-create-by-name.js
export default async function handler(req, res) {
  try {
    const token = req.cookies?.access_token;
    if (!token) return res.status(401).json({ error: "No access_token cookie" });

    const { notebook, section, title, body } = req.query;
    if (!notebook || !section)
      return res
        .status(400)
        .json({ error: "Missing required ?notebook=...&section=..." });

    // Step 1: find notebook ID by name
    const nbResp = await fetch(
      "https://graph.microsoft.com/v1.0/me/onenote/notebooks?$select=id,displayName",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const nbJson = await nbResp.json();
    if (!nbResp.ok) return res.status(nbResp.status).json(nbJson);

    const nb = (nbJson.value || []).find(
      (n) => n.displayName.toLowerCase() === notebook.toLowerCase()
    );
    if (!nb) return res.status(404).json({ error: `Notebook not found: ${notebook}` });

    // Step 2: find section ID by name
    const secResp = await fetch(
      `https://graph.microsoft.com/v1.0/me/onenote/notebooks/${encodeURIComponent(
        nb.id
      )}/sections?$select=id,displayName`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const secJson = await secResp.json();
    if (!secResp.ok) return res.status(secResp.status).json(secJson);

    const sec = (secJson.value || []).find(
      (s) => s.displayName.toLowerCase() === section.toLowerCase()
    );
    if (!sec) return res.status(404).json({ error: `Section not found: ${section}` });

    // Step 3: build XHTML page body
    const html = `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en-US">
  <head>
    <title>${escapeXml(title || "Untitled from Router")}</title>
    <meta name="created" content="${new Date().toISOString()}" />
  </head>
  <body>
    <p>${escapeXml(body || "No content provided")}</p>
  </body>
</html>`;

    // Step 4: POST create page
    const r = await fetch("https://graph.microsoft.com/v1.0/me/onenote/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/xhtml+xml",
        Accept: "application/json",
        "onenote-section-id": sec.id,
      },
      body: html,
    });

    const j = await r.json();
    if (!r.ok) return res.status(r.status).json(j);

    return res.status(201).json({
      created: {
        id: j.id,
        title: j.title,
        section: sec.displayName,
        notebook: nb.displayName,
        createdDateTime: j.createdDateTime,
        link: j.links?.oneNoteClientUrl?.href || null,
      },
      raw: j,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
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
