// pages/api/graph/me.js
export default async function handler(req, res) {
  const raw = req.cookies?.session;
  if (!raw) return res.status(401).json({ error: "No session cookie found" });

  let session;
  try { session = JSON.parse(raw); } catch { return res.status(400).json({ error: "Bad session cookie" }); }
  const accessToken = session?.access_token;
  if (!accessToken) return res.status(401).json({ error: "No access_token in session" });

  const resp = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const json = await resp.json();
  res.status(resp.ok ? 200 : 400).json(json);
}
