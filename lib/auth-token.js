// lib/auth-token.js
// Unified way to fetch a Graph token: KV → Authorization header → cookies.

import { kvGet } from '@/lib/kv';

const KV_CANDIDATES = ['graph:access_token', 'ms:access_token', 'access_token'];

function pickFromHeader(req) {
  const h = req.headers?.authorization || req.headers?.Authorization;
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/.exec(h);
  return m ? m[1] : null;
}

function pickFromCookies(req) {
  const raw = req.headers?.cookie || '';
  for (const part of raw.split(';')) {
    const [k, v] = part.trim().split('=');
    if (!k || !v) continue;
    if (k.toLowerCase() === 'authorization') {
      const dec = decodeURIComponent(v);
      const m = /^Bearer\s+(.+)$/.exec(dec);
      if (m) return m[1];
    }
    if (k.toLowerCase() === 'access_token') return decodeURIComponent(v);
  }
  return null;
}

export async function getGraphToken(req) {
  for (const key of KV_CANDIDATES) {
    const t = await kvGet(key);
    if (t) return { token: t, source: `kv:${key}` };
  }
  const h = pickFromHeader(req);
  if (h) return { token: h, source: 'header' };
  const c = pickFromCookies(req);
  if (c) return { token: c, source: 'cookie' };
  return { token: null, source: 'none' };
}
