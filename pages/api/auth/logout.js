// pages/api/auth/logout.js
// Hard logout: delete server tokens and expire ALL cookies on this domain.

import { kvDel } from '@/lib/kv';

const KV_KEYS = [
  'graph:access_token',
  'ms:access_token',
  'access_token',
  'ms:refresh_token',
  'auth:access_token'
];

function expire(name, domain) {
  // Expire cookie for root path; include HttpOnly/Secure to catch httpOnly cookies
  return `${name}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; ${
    domain ? `Domain=${domain}; ` : ''
  }Secure; HttpOnly`;
}

export default async function handler(req, res) {
  try {
    // 1) Clear server-side tokens in KV
    const deleted = {};
    for (const k of KV_KEYS) deleted[k] = await kvDel(k);

    // 2) Collect ALL cookies and expire them
    const raw = req.headers.cookie || '';
    const names = [...new Set(raw.split(';').map(s => s.trim().split('=')[0]).filter(Boolean))];

    // Attempt with current host as Domain as well (helps with www/app subdomain cases)
    const host = req.headers.host || '';
    const domain = host.includes('.') ? '.' + host.split(':')[0].split('.').slice(-2).join('.') : '';

    const setCookies = [];
    for (const n of names) {
      setCookies.push(expire(n, ''));           // current host
      if (domain) setCookies.push(expire(n, domain)); // parent domain
    }
    if (setCookies.length) res.setHeader('Set-Cookie', setCookies);

    return res.status(200).json({
      ok: true,
      clearedCookies: names,
      deletedKeys: deleted
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
