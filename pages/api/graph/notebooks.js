// pages/api/graph/notebooks.js
// Returns a neat list of { id, name, lastModified } for all notebooks.

export default async function handler(req, res) {
  try {
    const token = req.cookies?.access_token;
    if (!token) return res.status(401).json({ error: "Not signed in. Visit /login first." });

    const top = Math.max(1, Math.min(100, parseInt(req.query.top, 10) || 50));
    const url = new URL("https://graph.microsoft.com/v1.0/me/onenote/notebooks");
    url.searchParams.set("$top", String(top));
    url.searchParams.set("$select", "id,displayName,lastModifiedDateTime");
    url.searchParams.set("$orderby", "lastModifiedDateTime desc");

    const r = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${decodeURIComponent(token)}` },
    });

    const json = await r.json();
    if (!r.ok) return res.status(r.status).json(json);

    const items = (json.value || []).map(n => ({
      id: n.id,
      name: n.displayName,
      lastModified: n.lastModifiedDateTime,
    }));

    res.status(200).json({ notebooks: items });
  } catch (err) {
    res.status(502).json({ error: "Graph call failed", details: String(err) });
  }
}
