// pages/api/onenote/seed.js
// Save an access token in KV so server routes can use it (no header needed later).

import { kvSet } from '@/lib/kv';

function extractToken(req) {
  // 1) From Authorization header
  const h = req.headers.authorization || req.headers.Authorization;
  if (typeof h === 'string') {
    const m = h.match(/^Bearer\s+(.+)$/i);
    if (m && m[1] && m[1].includes('.')) return m[1].trim();
  }

  // 2) From JSON body: { "token": "..." }
  if (req.method === 'POST' && req.headers['content-type']?.includes('application/json')) {
    try {
      // In Next.js API routes, body may already be parsed. Fallback to raw text if needed.
      const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (b && typeof b.token === 'string' && b.token.includes('.')) return b.token.trim();
    } catch {}
  }

  // 3) From query string: /seed?t=...
  const t = req.query?.t;
  if (typeof t === 'string' && t.includes('.')) return t.trim();

  return null;
}

export default async function handler(req, res) {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(400).json({
        ok: false,
        error: 'Provide token via Authorization: Bearer <token>, or JSON body { "token": "<token>" }, or ?t=<token>'
      });
    }

    // Save under common keys our code probes
    await kvSet('ms:access_token', token, { ex: 3600 });
    await kvSet('graph:access_token', token, { ex: 3600 });
    await kvSet('access_token', token, { ex: 3600 });

    return res.status(200).json({
      ok: true,
      savedKeys: ['ms:access_token','graph:access_token','access_token']
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
