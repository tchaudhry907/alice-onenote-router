// pages/api/graph/pages-by-name.js
// Lists pages in a section by notebook+section names.
// Usage:
//   /api/graph/pages-by-name?notebook=AliceChatGPT&section=Inbox&top=25
//
// Returns: { pages: [{ id, title, created, lastModified, webUrl, clientUrl }], rawNextLink }

export default async function handler(req, res) {
  try {
    const token = req.cookies?.access_token;
    if (!token) return res.status(401).json({ error: "No access_token cookie" });

    const notebook = String(req.query.notebook || "").trim();
    const section  = String(req.query.section  || "").trim();
    const top = Math.max(1, Math.min(100, parseInt(req.query.top, 10) || 25));

    if (!notebook || !section) {
      return res.status(400).json({ error: "Missing ?notebook=...&section=..." });
    }

    // 1) Resolve notebook by name
    const nbUrl = new URL("https://graph.microsoft.com/v1.0/me/onenote/notebooks");
    nbUrl.searchParams.set("$top", "100");
    nbUrl.searchParams.set("$select", "id,displayName");

    const nbResp = await fetch(nbUrl.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const nbJson = await nbResp.json();
    if (!nbResp.ok) return res.status(nbResp.status).json(nbJson);

    const nb = (nbJson.value || []).find(
      n => (n.displayName || "").toLowerCase() === notebook.toLowerCase()
    );
    if (!nb) return res.status(404).json({ error: `Notebook not found: ${notebook}` });

    // 2) Resolve section by name
    const secUrl = new URL(`https://graph.microsoft.com/v1.0/me/onenote/notebooks/${encodeURIComponent(nb.id)}/sections`);
    secUrl.searchParams.set("$select", "id,displayName");

    const secResp = await fetch(secUrl.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const secJson = await secResp.json();
    if (!secResp.ok) return res.status(secResp.status).json(secJson);

    const sec = (secJson.value || []).find(
      s => (s.displayName || "").toLowerCase() === section.toLowerCase()
    );
    if (!sec) return res.status(404).json({ error: `Section not found: ${section}` });

    // 3) List pages in the resolved section
    const pagesUrl = new URL(`https://graph.microsoft.com/v1.0/me/onenote/sections/${encodeURIComponent(sec.id)}/pages`);
    pagesUrl.searchParams.set("$top", String(top));
    pagesUrl.searchParams.set("$select", "id,title,createdDateTime,lastModifiedDateTime,links,contentUrl");
    pagesUrl.searchParams.set("$orderby", "lastModifiedDateTime desc");

    const pResp = await fetch(pagesUrl.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const pJson = await pResp.json();
    if (!pResp.ok) return res.status(pResp.status).json(pJson);

    const pages = (pJson.value || []).map(p => ({
      id: p.id,
      title: p.title,
      created: p.createdDateTime,
      lastModified: p.lastModifiedDateTime,
      webUrl: p?.links?.oneNoteWebUrl?.href || null,
      clientUrl: p?.links?.oneNoteClientUrl?.href || null,
      contentUrl: p.contentUrl || null,
    }));

    return res.status(200).json({ pages, rawNextLink: pJson["@odata.nextLink"] || null });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
