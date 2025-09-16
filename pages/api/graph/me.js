// pages/api/graph/me.js

import { getAccessToken } from '@/lib/auth';

async function resolveToken(req, res) {
  // Prefer Authorization: Bearer ...
  const auth = req.headers?.authorization || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (m && m[1]) return m[1];

  // Fallback to cookie/session
  const t = await getAccessToken(req, res);
  return t || null;
}

export default async function handler(req, res) {
  try {
    const token = await resolveToken(req, res);
    if (!token) {
      return res.status(401).json({ error: 'No access token' });
    }

    const r = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${token}` }
    });

    const text = await r.text();
    if (!r.ok) {
      return res.status(r.status).json({ error: text || 'Graph error' });
    }
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).send(text);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
