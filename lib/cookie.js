// lib/cookie.js
// Minimal cookie helper for session key -> stored refresh token in KV.

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

  if (o.maxAge) parts.push(`Max-Age=${o.maxAge}`);
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

export function getTokenKeyFromReq(req) {
  const raw = req.headers.cookie || "";
  const obj = Object.fromEntries(
    raw.split(/;\s*/).filter(Boolean).map(kv => {
      const i = kv.indexOf("=");
      const k = kv.slice(0, i);
      const v = kv.slice(i + 1);
      return [k, decodeURIComponent(v)];
    })
  );
  return obj[COOKIE_NAME] || null;
}
