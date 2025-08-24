// pages/api/onenote.js
export default async function handler(req, res) {
  try {
    const token = req.cookies?.access_token;
    if (!token) return res.status(401).json({ error: "No access token. Sign in first." });

    const r = await fetch("https://graph.microsoft.com/v1.0/me/onenote/notebooks", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await r.json();
    res.status(r.ok ? 200 : r.status).json(data);
  } catch (e) {
    console.error("Graph OneNote error:", e);
    res.status(500).json({ error: "Failed to fetch OneNote notebooks" });
  }
}
