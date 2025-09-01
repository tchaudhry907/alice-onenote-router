// pages/api/graph/create-section.js
export default async function handler(req, res) {
  try {
    const token = req.cookies?.access_token;
    const notebookId = req.query.notebookId;
    const name = req.query.name || "Inbox";

    if (!token) return res.status(401).json({ error: "No access_token cookie" });
    if (!notebookId) return res.status(400).json({ error: "Missing notebookId" });

    const url = `https://graph.microsoft.com/v1.0/me/onenote/notebooks/${encodeURIComponent(
      notebookId
    )}/sections`;

    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ displayName: name }),
    });

    const j = await r.json();
    if (!r.ok) return res.status(r.status).json(j);

    return res.status(201).json({
      created: { id: j.id, name: j.displayName },
      raw: j,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
