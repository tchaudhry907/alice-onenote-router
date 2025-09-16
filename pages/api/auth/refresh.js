// pages/api/auth/refresh.js
import { refreshAccessToken, readCookie } from '@/lib/auth';

function setTokenCookies(res, tokens) {
  const opts = [
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Max-Age=7200',
  ];
  const cookies = [];
  if (tokens.access_token) cookies.push(`access_token=${encodeURIComponent(tokens.access_token)}; ${opts.join('; ')}`);
  if (tokens.refresh_token) cookies.push(`refresh_token=${encodeURIComponent(tokens.refresh_token)}; ${opts.join('; ')}`);
  if (tokens.id_token) cookies.push(`id_token=${encodeURIComponent(tokens.id_token)}; ${opts.join('; ')}`);
  if (cookies.length) res.setHeader('Set-Cookie', cookies);
}

export default async function handler(req, res) {
  try {
    // prefer cookie; allow header fallback
    const rt = readCookie(req, 'refresh_token') || (req.headers['x-refresh-token'] || '');
    if (!rt) return res.status(400).json({ ok: false, error: 'No refresh_token' });

    const tokens = await refreshAccessToken(rt);
    setTokenCookies(res, tokens);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(401).json({ ok: false, error: String(e.message || e) });
  }
}
