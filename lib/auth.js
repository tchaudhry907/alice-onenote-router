// lib/auth.js
//
// Centralized Microsoft Graph auth for API routes.
// Features:
//  - Accepts bearer from Authorization header (preferred)
//  - Falls back to access_token cookie if present
//  - If missing/invalid, auto-refreshes using MS_REFRESH_TOKEN + client credentials
//  - One retry on 401/invalid token
//
// Exports kept for back-compat with your other routes: getAccessToken, requireAuth.

const MS_TOKEN_URL = `https://login.microsoftonline.com/${process.env.MS_TENANT_ID || "common"}/oauth2/v2.0/token`;

/**
 * Try to extract a bearer token from:
 *  1) Authorization header: "Bearer <token>"
 *  2) Cookie: access_token=<token>
 */
export function getAccessToken(req) {
  // 1) Authorization header
  const auth = req.headers["authorization"] || req.headers["Authorization"];
  if (auth && typeof auth === "string") {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m && m[1]) return m[1].trim();
  }
  // 2) Cookie
  const rawCookie = req.headers.cookie || req.headers.Cookie || "";
  if (rawCookie) {
    const parts = rawCookie.split(/;\s*/g);
    for (const p of parts) {
      const [k, v] = p.split("=");
      if (k && v && k.trim() === "access_token") return decodeURIComponent(v.trim());
    }
  }
  return null;
}

/**
 * Use the refresh_token + client credentials to fetch a new access_token.
 * Requires env: MS_CLIENT_ID, MS_CLIENT_SECRET, MS_REFRESH_TOKEN
 */
export async function refreshAccessToken() {
  const client_id = process.env.MS_CLIENT_ID;
  const client_secret = process.env.MS_CLIENT_SECRET;
  const refresh_token = process.env.MS_REFRESH_TOKEN;

  if (!client_id || !client_secret || !refresh_token) {
    const missing = [
      !client_id && "MS_CLIENT_ID",
      !client_secret && "MS_CLIENT_SECRET",
      !refresh_token && "MS_REFRESH_TOKEN",
    ].filter(Boolean).join(", ");
    throw new Error(`[auth] Missing env for refresh: ${missing}`);
  }

  const params = new URLSearchParams();
  params.set("grant_type", "refresh_token");
  params.set("client_id", client_id);
  params.set("client_secret", client_secret);
  params.set("refresh_token", refresh_token);
  // Microsoft Graph default scopes
  params.set("scope", "openid profile offline_access Files.ReadWrite.All Notes.ReadWrite.All");

  const r = await fetch(MS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const json = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = json?.error_description || JSON.stringify(json) || `HTTP ${r.status}`;
    throw new Error(`[auth] refresh failed: ${msg}`);
  }

  // NOTE: We cannot mutate Vercel env at runtime; we just return the fresh access_token.
  // If you want to rotate refresh_token as Microsoft issues a new one, store it in KV.
  return {
    access_token: json.access_token,
    expires_in: json.expires_in,
    token_type: json.token_type,
    scope: json.scope,
    // json.refresh_token may be present; persisting it would require KV.
  };
}

/**
 * Build headers for Graph with a valid token. If missing/invalid, auto-refresh once.
 * Returns { headers, tokenUsed, refreshed }.
 */
export async function graphAuthHeaders(req, tryRefreshOnFail = true) {
  let token = getAccessToken(req);
  if (!token && tryRefreshOnFail) {
    // No token present — try refresh
    const fresh = await refreshAccessToken();
    token = fresh.access_token;
  }
  if (!token) {
    throw new Error("No access token present and refresh not available");
  }
  return {
    headers: { Authorization: `Bearer ${token}` },
    tokenUsed: token,
    refreshed: !getAccessToken(req),
  };
}

/**
 * Fetch helper that auto-retries once on 401 by refreshing the token.
 */
export async function graphFetch(req, path, init = {}) {
  const url = path.startsWith("http") ? path : `https://graph.microsoft.com/v1.0${path}`;

  // first attempt (may refresh if no token at all)
  let { headers } = await graphAuthHeaders(req, true);
  const merged1 = { ...init, headers: { ...(init.headers || {}), ...headers } };
  let resp = await fetch(url, merged1);

  if (resp.status === 401) {
    // try refresh and retry once
    const { headers: h2 } = await graphAuthHeaders(req, true);
    const merged2 = { ...init, headers: { ...(init.headers || {}), ...h2 } };
    resp = await fetch(url, merged2);
  }
  return resp;
}

/**
 * Simple guard you can call at route start.
 */
export async function requireAuth(req, res) {
  try {
    await graphAuthHeaders(req, true);
    return true;
  } catch (err) {
    res.status(401).json({ ok: false, error: String(err.message || err) });
    return false;
  }
}
