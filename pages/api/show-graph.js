// pages/api/show-graph.js
import { getToken } from "next-auth/jwt";

export default async function handler(req, res) {
  try {
    const token = await getToken({ req });
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Example query to test Graph connection
    const response = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    return res.status(200).json({ ok: true, data });
  } catch (err) {
    console.error("Graph test failed", err);
    return res.status(500).json({ error: "Graph request failed", details: err.message });
  }
}
