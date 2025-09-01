// pages/api/graph/notebook-by-name.js
// Usage: /api/graph/notebook-by-name?name=AliceChatGPT
// Returns { id, name } or 404 if not found.

export default async function handler(req, res) {
  try {
    const token = req.cookies?.access_token;
    if (!token) return res.status(401).json({ error: "Not signed in. Visit /login first." });

    const name = String(req.query.name || "").trim();
    if (!name) return res.status(400).json({ error: "Missing ?name=..." });

    // Fetch notebooks (up to 100)
    const url = new URL("https://graph.microsoft.com/v1.0/me/onenote/notebooks");
    url.searchParams.set("$top", "100");
    url.searchParams.set("$select", "id,displayName,lastModifiedDateTime");

    const r = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${decodeURIComponent(token)}` },
    });
    const json = await r.json();
    if (!r.ok) return res.status(r.status).json(json);

    const match = (json.value || []).find(n => (n.displayName || "").toLowerCase() === name.toLowerCase());
    if (!match) return res.status(404).json({ error: "Notebook not found", name });

    res.status(200).json({ id: match.id, name: match.displayName });
  } catch (err) {
    res.status(502).json({ error: "Graph call failed", details: String(err) });
  }
}
