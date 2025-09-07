// /lib/auth.js
// Minimal, production-safe auth helpers for our OneNote Router.
// Exports:
//   - requireAuth(handler)        -> wraps an API handler (currently permissive)
//   - getAccessToken(session?)    -> returns a Graph access token (prefers session, falls back to bound)
//   - getBoundAccessToken()       -> refresh-token based, cookie-free token (used by curl/Shortcuts)

import { get as kvGet, set as kvSet } from "@/lib/kv";

/** ------------------------------------------------------------------------
 * Cookie-free, bound access token (uses refresh token saved by /api/cron/bind)
 * KV keys:
 *  - "bound:refresh_token"
 *  - "bound:access_token"
 *  - "bound:access_expires"   // epoch ms
 * Env:
 *  - MS_CLIENT_ID, MS_CLIENT_SECRET, MS_REDIRECT_URI
 *  - (optional) MS_TENANT_ID  (defaults to "common")
 * ----------------------------------------------------------------------- */
export async function getBoundAccessToken() {
  const now = Date.now();
  const cached = await kvGet("bound:access_token");
  const expStr = await kvGet("bound:access_expires");
  const exp = expStr ? Number(expStr) : 0;

  // Reuse cached token if >60s left
  if (cached && exp - now > 60_000) return cached;

  const refresh = await kvGet("bound:refresh_token");
  if (!refresh) return null; // not bound yet

  const tenant = process.env.MS_TENANT_ID || "common";
  const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID || "",
    client_secret: process.env.MS_CLIENT_SECRET || "",
    redirect_uri: process.env.MS_REDIRECT_URI || "",
    grant_type: "refresh_token",
    refresh_token: refresh,
  });

  const resp = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const j = await resp.json().catch(() => ({}));
  if (!resp.ok || !j.access_token) {
    throw new Error(
      JSON.stringify({
        status: resp.status,
        body: j || "(no body)",
        where: "getBoundAccessToken(refresh)",
      })
    );
  }

  const accessToken = j.access_token;
  const expiresInSec = Number(j.expires_in || 3600);
  const newExp = Date.now() + expiresInSec * 1000;

  await kvSet("bound:access_token", accessToken);
  await kvSet("bound:access_expires", String(newExp));

  // Microsoft may rotate the refresh token
  if (j.refresh_token && j.refresh_token !== refresh) {
    await kvSet("bound:refresh_token", j.refresh_token);
  }

  return accessToken;
}

/** Prefer session access token (if your middleware sets it), else fall back to bound token. */
export async function getAccessToken(session) {
  // If your session object carries an access token and it's still valid, use it.
  if (session && typeof session.access_token === "string" && session.access_token.length > 0) {
    return session.access_token;
  }
  // Otherwise use our cookie-free bound token
  return await getBoundAccessToken();
}

/** Wrapper for API routes. Currently permissive:
 *   - Calls the handler with (req, res, session|null)
 *   - If you later add real session parsing, do it here.
 */
export function requireAuth(handler) {
  return async (req, res) => {
    // TODO: parse your session cookie if/when needed.
    const session = null;
    return handler(req, res, session);
  };
}
