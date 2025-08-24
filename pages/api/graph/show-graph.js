// pages/api/show-graph.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  try {
    // You should already have a "session" cookie set by the callback route
    if (!req.cookies?.session) {
      return res.status(401).json({ error: "No session cookie set. Please sign in first." });
    }

    const session = JSON.parse(req.cookies.session);
    const accessToken = session.access_token;

    if (!accessToken) {
      return res.status(401).json({ error: "No access_token in session. Sign in again." });
    }

    // Call Microsoft Graph: /me
    const r = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    });

    const data = await r.json();
    return res.status(r.ok ? 200 : r.status).json(data);
  } catch (err) {
    console.error("Error calling Graph:", err);
    return res.status(500).json({ error: "Failed to call Graph API" });
  }
}
