// lib/auth.js
/**
 * Minimal Graph auth utilities with header/cookie support + refresh.
 * Exports the symbols other routes were importing to avoid build errors.
 */

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

export function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('=') || '');
  }
  return '';
}

export function bearerFromAuthzHeader(req) {
  const h = req.headers.authorization || req.headers.Authorization;
  if (!h) return '';
  const m = /^Bearer\s+(.+)$/.exec(h);
  return m ? m[1] : '';
}

/** Primary: Authorization header. Fallback: cookie access_token. Fallback: env. */
export function getBearerFromReq(req) {
  return (
    bearerFromAuthzHeader(req) ||
    readCookie(req, 'access_token') ||
    process.env.MS_GRAPH_BEARER ||
    ''
  );
}

export async function authHeaders(req, contentType = 'application/json') {
  const bearer = getBearerFromReq(req);
  if (!bearer) throw new Error('No access token');
  const h = { Authorization: `Bearer ${bearer}` };
  if (contentType) h['Content-Type'] = contentType;
  return h;
}

// ---- Refresh support (server-managed) ----
async function tokenRequest(params) {
  const body = new URLSearchParams(params);
  const tenant = process.env.MS_TENANT || 'consumers';
  const url = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`token endpoint ${r.status}: ${text}`);
  }
  return r.json();
}

export async function refreshAccessToken(refresh_token) {
  const client_id = process.env.MS_CLIENT_ID;
  const client_secret = process.env.MS_CLIENT_SECRET; // optional for public apps
  if (!client_id || !refresh_token) throw new Error('Missing client_id or refresh_token');

  const params = {
    client_id,
    scope: 'openid profile offline_access https://graph.microsoft.com/.default',
    grant_type: 'refresh_token',
    refresh_token,
  };
  if (client_secret) params.client_secret = client_secret;

  return tokenRequest(params);
}

/** Try a call. If 401, attempt refresh using refresh_token cookie once. */
export async function graphFetch(req, path, init = {}) {
  // first try with whatever we have
  try {
    const headers = new Headers(init.headers || {});
    if (!headers.has('Authorization')) {
      const bearer = getBearerFromReq(req);
      if (!bearer) throw new Error('No access token');
      headers.set('Authorization', `Bearer ${bearer}`);
    }
    init.headers = headers;
    const r1 = await fetch(`${GRAPH_BASE}${path}`, init);
    if (r1.status !== 401) return r1;

    // try refresh once
    const rt = readCookie(req, 'refresh_token');
    if (!rt) return r1;

    const tokens = await refreshAccessToken(rt);
    // set-cookie header is done in API route (handler) after we return details
    // so pass tokens back via throw marker the route can catch (lightweight)
    const err = new Error('REFRESHED');
    err.__tokens = tokens;
    throw err;
  } catch (e) {
    throw e;
  }
}

export async function graphGET(req, path) {
  // wrapper that handles refresh and retry
  try {
    const r = await graphFetch(req, path, { method: 'GET' });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  } catch (e) {
    if (e?.message === 'REFRESHED') {
      // Route must catch this; rethrow so handler can set cookies and retry.
      throw e;
    }
    throw e;
  }
}

export async function graphPOST(req, path, body, contentType = 'application/json') {
  try {
    const headers = new Headers();
    if (contentType) headers.set('Content-Type', contentType);
    const r = await graphFetch(req, path, {
      method: 'POST',
      headers,
      body: contentType === 'application/json' ? JSON.stringify(body) : body,
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  } catch (e) {
    if (e?.message === 'REFRESHED') throw e;
    throw e;
  }
}

/** Legacy helpers some routes imported */
export async function getAccessToken(req) {
  const b = getBearerFromReq(req);
  if (!b) throw new Error('No access token');
  return b;
}

export function requireAuth(req, res) {
  if (!getBearerFromReq(req)) {
    res.status(401).json({ ok: false, error: 'No access token' });
    return false;
  }
  return true;
}
