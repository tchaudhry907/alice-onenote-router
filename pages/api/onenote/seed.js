// pages/api/onenote/seed.js
// Save an access token in KV so server routes can use it (no header needed later).
// Now with strong sanitizing to remove hidden characters.

import { kvSet } from '@/lib/kv';

function cleanToken(raw) {
  if (typeof raw !== 'string') return null;
  // Strip surrounding quotes and whitespace
  let t = raw.trim().replace(/^["'\u201C\u201D]+|["'\u201C\u201D]+$/g, '');
  // Remove zero-width and non-printing chars
  t = t.replace(/[\u200B-\u200D\uFEFF]/g, '');
  // Collapse spaces
  t = t.replace(/\s+/g, '');
  // Keep only base64url-safe token chars plus dots
  t = t.replace(/[^A-Za-z0-9._-]/g, '');
  // Basic sanity: JWT should have two dots and start with eyJ
  if (!t.includes('.') || (t.match(/\./g) || []).length < 2) return null;
  if (!t.startsWith('eyJ')) return null;
  return t;
}

function extractToken(req) {
  // 1) Authorization header
  const h = req.headers.authorization || req.headers.Authorization;
  if (typeof h === 'string') {
    const m = h.match(/^Bearer\s+(.+)$/i);
    const c = cleanToken(m ? m[1] : h);
    if (c) return c;
  }
  // 2) JSON body: { "token": "..." }
  if (req.method === 'POST' && req.headers['content-type']?.includes('application/json')) {
    try {
      const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const c = cleanToken(b?.token);
      if (c) return c;
    } catch {}
  }
  // 3) Query: /seed?t=...
  const c = cleanToken(req.query?.t);
  if (c) return c;
  return null;
}

export default async function handler(req, res) {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(400).json({
        ok: false,
        error: 'Provide a valid JWT via Authorization: Bearer <token>, body { "token": "<token>" }, or ?t=<token>'
      });
    }
    await kvSet('ms:access_token', token, { ex: 3600 });
    await kvSet('graph:access_token', token, { ex: 3600 });
    await kvSet('access_token', token, { ex: 3600 });
    return res.status(200).json({
      ok: true,
      savedKeys: ['ms:access_token','graph:access_token','access_token'],
      prefix: token.slice(0, 12) // small sanity peek
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
