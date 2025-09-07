// lib/auth.js
// Keep your existing code/exports at the top of this file.
// The only requirement is that the kv helper below resolves correctly.

import { get as kvGet, set as kvSet } from "@/lib/kv";

/**
 * Return a bound (cookie-free) Graph access token.
 * Requires that /api/cron/bind has already stored a refresh token in KV.
 *
 * KV keys used:
 *  - "bound:refresh_token"
 *  - "bound:access_token"
 *  - "bound:access_expires"  (epoch ms)
 *
 * Env required (same ones you already use for login):
 *  - MS_CLIENT_ID
 *  - MS_CLIENT_SECRET
 *  - MS_REDIRECT_URI
 *  - (optional) MS_TENANT_ID   // falls back to 'common'
 */
export async function getBoundAccessToken() {
  const now = Date.now();
  const cached = await kvGet("bound:access_token");
  const expStr = await kvGet("bound:access_expires");
  const exp = expStr ? Number(expStr) : 0;

  // Reuse if we still have >60s left
  if (cached && exp - now > 60_000) {
    return cached;
  }

  const refresh = await kvGet("bound:refresh_token");
  if (!refresh) {
    // not bound yet
    return null;
  }

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
    // Bubble up a readable error for callers
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

  // Microsoft can rotate refresh_token; store the new one if provided
  if (j.refresh_token && j.refresh_token !== refresh) {
    await kvSet("bound:refresh_token", j.refresh_token);
  }

  return accessToken;
}

/**
 * OPTIONAL convenience: if your existing code imports getAccessToken(session),
 * you can safely fall back to the bound flow when session isn’t present.
 * If you already have a getAccessToken() defined above, keep it.
 * If not, uncomment the version below.
 */

// export async function getAccessToken(/* session */) {
//   // Fallback to bound token so endpoints work without cookies
//   return getBoundAccessToken();
// }

/**
 * OPTIONAL passthrough requireAuth.
 * If you already have a proper requireAuth, keep it.
 * This is just a harmless placeholder in case it’s missing.
 */
// export const requireAuth = (handler) => async (req, res, session = null) =>
//   handler(req, res, session);
