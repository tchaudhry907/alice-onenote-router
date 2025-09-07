// lib/cookie.js
// Session cookie helpers — includes a compat shim for getTokenCookie()

import crypto from "crypto";

export const COOKIE_NAME = "alice_session";

// Build a Set-Cookie header string
function buildCookie(name, value, opts = {}) {
  const parts = [`${name}=${value}`];
  const defaultOpts = {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  };
  const o = { ...defaultOpts, ...opts };

  if (o.maxAge != null) parts.push(`Max-Age=${o.maxAge}`);
  if (o.expires) parts.push(`Expires=${o.expires.toUTCString()}`);
  if (o.path) parts.push(`Path=${o.path}`);
  if (o.domain) parts.push(`Domain=${o.domain}`);
  if (o.secure) parts.push(`Secure`);
  if (o.httpOnly) parts.push(`HttpOnly`);
  if (o.sameSite) parts.push(`SameSite=${o.sameSite}`);

  return parts.join("; ");
}

export function setTokenCookie(res) {
  const key = `sess:${crypto.randomBytes(16).toString("hex")}`;
  res.setHeader("Set-Cookie", buildCookie(COOKIE_NAME, encodeURIComponent(key)));
  return key;
}

export function clearTokenCookie(res) {
  res.setHeader(
    "Set-Cookie",
    buildCookie(COOKIE_NAME, "", { maxAge: 0, expires: new Date(0) })
  );
}

/**
 * Parse request cookies and return the session key (or null).
 */
export function getTokenKeyFromReq(req) {
  const raw = req.headers?.cookie || "";
  if (!raw) return null;
  const pairs = raw.split(/;\s*/).filter(Boolean);
  for (const kv of pairs) {
    const idx = kv.indexOf("=");
    if (idx === -1) continue;
    const name = kv.slice(0, idx);
    const val = kv.slice(idx + 1);
    if (name === COOKIE_NAME) {
      try {
        return decodeURIComponent(val || "");
      } catch {
        return val || "";
      }
    }
  }
  return null;
}

/**
 * ✅ Compat shim used by older routes:
 *    Many files call `const tok = getTokenCookie(req); if (!tok?.key) ...`
 *    This returns `{ key: <sessionKey> }` or `null`.
 */
export function getTokenCookie(req) {
  const key = getTokenKeyFromReq(req);
  return key ? { key } : null;
}
