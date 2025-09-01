// pages/api/graph/pages.js
// Lists pages for a given sectionId.
// Usage:
//   /api/graph/pages?sectionId=SECTION_ID&top=25&select=id,title,createdDateTime,lastModifiedDateTime,contentUrl
//
// Returns: { pages: [...], rawNextLink }

export default async function handler(req, res) {
  try {
    const token = req.cookies?.access_token;
    if (!token) return res.status(401).json({ error: "No access_token cookie" });

    const sectionId = String(req.query.sectionId || "").trim();
    if (!sectionId) return res.status(400).json({ error: "Missing sectionId" });

    const top = Math.max(1, Math.min(100, parseInt(req.query.top, 10) || 25));
    const select = String(req.query.select || "id,title,createdDateTime,lastModifiedDateTime,links,contentUrl");

    const url = new URL(`https://graph.microsoft.com/v1.0/me/onenote/sections/${encodeURIComponent(sectionId)}/pages`);
    url.searchParams.set("$top", String(top));
    url.searchParams.set("$select", select);
    url.searchParams.set("$orderby", "lastModifiedDateTime desc");

    const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${decodeURIComponent(token)}` } });
    const j = await r.json();
    if (!r.ok) return res.status(r.status).json(j);

    const pages = (j.value || []).map(p => ({
      id: p.id,
      title: p.title,
      created: p.createdDateTime,
      lastModified: p.lastModifiedDateTime,
      webUrl: p?.links?.oneNoteWebUrl?.href || null,
      clientUrl: p?.links?.oneNoteClientUrl?.href || null,
      contentUrl: p.contentUrl || null,
    }));

    return res.status(200).json({ pages, rawNextLink: j["@odata.nextLink"] || null });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
