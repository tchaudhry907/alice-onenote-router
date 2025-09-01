// pages/api/graph/sections.js
export default async function handler(req, res) {
  try {
    const { notebookId } = req.query;
    const token = req.cookies?.access_token;

    if (!token) return res.status(401).json({ error: "No access_token cookie" });
    if (!notebookId) return res.status(400).json({ error: "Missing notebookId" });

    const url = `https://graph.microsoft.com/v1.0/me/onenote/notebooks/${encodeURIComponent(
      notebookId
    )}/sections?$select=id,displayName,lastModifiedDateTime`;

    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json();

    if (!r.ok) return res.status(r.status).json(j);

    const sections =
      (j.value || []).map(s => ({
        id: s.id,
        name: s.displayName,
        lastModified: s.lastModifiedDateTime,
      })) ?? [];

    return res.status(200).json({ sections });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
