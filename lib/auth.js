// /lib/auth.js
// Minimal helpers for API routes to obtain a valid Graph access token.
// Reads cookies set by your login flow, and refreshes using refresh_token.

const TOKEN_COOKIE = 'ms_access_token';
const REFRESH_COOKIE = 'ms_refresh_token';
const EXPIRES_COOKIE = 'ms_access_expires'; // unix seconds

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

function setCookie(res, name, value, opts = {}) {
  const {
    httpOnly = true,
    path = '/',
    sameSite = 'Lax',
    secure = true,
    maxAge,
  } = opts;
  const pieces = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, `SameSite=${sameSite}`];
  if (httpOnly) pieces.push('HttpOnly');
  if (secure) pieces.push('Secure');
  if (Number.isFinite(maxAge)) pieces.push(`Max-Age=${Math.floor(maxAge)}`);
  const header = pieces.join('; ');
  const prev = res.getHeader('Set-Cookie');
  if (!prev) res.setHeader('Set-Cookie', header);
  else if (Array.isArray(prev)) res.setHeader('Set-Cookie', [...prev, header]);
  else res.setHeader('Set-Cookie', [prev, header]);
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

async function refreshAccessToken(refreshToken) {
  const tenant = process.env.MS_TENANT;
  const clientId = process.env.MS_CLIENT_ID;
  const clientSecret = process.env.MS_CLIENT_SECRET;
  const scopes =
    process.env.MS_SCOPES ||
    'offline_access openid profile email Notes.ReadWrite.All User.Read';

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: scopes,
  });

  const resp = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await resp.json();
  if (!resp.ok) {
    const msg = json?.error_description || json?.error || 'Refresh failed';
    throw new Error(msg);
    }
  const { access_token, expires_in, refresh_token } = json;
  return {
    accessToken: access_token,
    refreshToken: refresh_token || refreshToken,
    expiresAt: nowSec() + (expires_in || 3600) - 30,
  };
}

// 👉 Named export used by your API routes
export async function getAccessToken(req, res) {
  // 1) Allow Bearer header for server-to-server calls
  const auth = req.headers.authorization || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice('bearer '.length).trim();
  }

  // 2) From cookies
  const access = readCookie(req, TOKEN_COOKIE);
  const expStr = readCookie(req, EXPIRES_COOKIE);
  const refresh = readCookie(req, REFRESH_COOKIE);

  if (access && expStr && Number(expStr) > nowSec() + 15) {
    return access;
  }

  // 3) Try refresh
  if (refresh) {
    const r = await refreshAccessToken(refresh);
    setCookie(res, TOKEN_COOKIE, r.accessToken, { maxAge: 60 * 60 * 24 * 7 });
    setCookie(res, EXPIRES_COOKIE, String(r.expiresAt), { maxAge: 60 * 60 * 24 * 7 });
    setCookie(res, REFRESH_COOKIE, r.refreshToken, { maxAge: 60 * 60 * 24 * 30 });
    return r.accessToken;
  }

  return null;
}

export async function getUserProfile(token) {
  const r = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`Graph /me failed (${r.status})`);
  return await r.json();
}
