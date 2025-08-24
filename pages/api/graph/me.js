// pages/api/graph/me.js

export default async function handler(req, res) {
  try {
    // Read and parse the token cookie we set in /api/auth/callback
    const cookieHeader = req.headers.cookie || "";
    const cookies = Object.fromEntries(
      cookieHeader.split(";").map(c => {
        const [k, ...v] = c.trim().split("=");
        return [k, v.join("=")];
      }).filter(([k]) => k)
    );

    if (!cookies.token) {
      res.status(401).json({ error: "No token cookie found. Sign in at /login and try again." });
      return;
    }

    let tokenJson;
    try {
      tokenJson = JSON.parse(decodeURIComponent(cookies.token));
    } catch {
      res.status(400).json({ error: "Malformed token cookie. Sign in again at /login." });
      return;
    }

    const { access_token, expires_at } = tokenJson || {};
    if (!access_token) {
      res.status(401).json({ error: "Missing access_token in cookie. Sign in again at /login." });
      return;
    }

    // Optional: basic expiry guard (expires_at is epoch seconds if you used my callback.js)
    if (expires_at && Date.now() / 1000 > Number(expires_at)) {
      res.status(401).json({ error: "Access token expired. Sign in again at /login." });
      return;
    }

    // Call Microsoft Graph
    const graph = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const body = await graph.text();
    const isJson = graph.headers.get("content-type")?.includes("application/json");
    res.status(graph.status).setHeader("content-type", isJson ? "application/json" : "text/plain").send(body);
  } catch (err) {
    res.status(500).json({ error: "Unexpected server error", detail: String(err?.stack || err) });
  }
}
