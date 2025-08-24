import fetch from 'node-fetch';

export default async function handler(req, res) {
  try {
    const token = req.cookies['access_token']; // stored from callback.js

    if (!token) {
      return res.status(401).json({ error: 'No access token. Sign in first.' });
    }

    const graphRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await graphRes.json();
    res.status(200).json(data);
  } catch (err) {
    console.error("Graph /me error:", err);
    res.status(500).json({ error: 'Failed to fetch /me' });
  }
}
