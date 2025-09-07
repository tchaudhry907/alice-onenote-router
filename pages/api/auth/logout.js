// /pages/api/auth/logout.js
//
// Full, copy-paste replacement.
// Clears all auth cookies, hits the Microsoft logout endpoint, and
// uses post_logout_redirect_uri to return you to your app.
// Optional: /api/auth/logout?then=login will return to a fresh login.
//
// Requires env:
//   - APP_BASE_URL (e.g. https://alice-onenote-router.vercel.app)
//   - MS_TENANT    (common or consumers; you already set this)

import { serialize } from "cookie";

function clearCookie(name) {
  return serialize(name, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export default async function handler(req, res) {
  const base =
    (process.env.APP_BASE_URL || "").replace(/\/+$/, "") ||
    "https://alice-onenote-router.vercel.app";

  const tenant = process.env.MS_TENANT || "common";
  const then = (req.query?.then || "").toString(); // "" | "login"

  // Where to send the browser after Microsoft finishes sign-out
  const returnPath = then === "login" ? "/api/auth/login?return=/debug/diagnostics"
                                      : "/debug/diagnostics";
  const postLogout = `${base}${returnPath}`;

  // Clear all cookies we set anywhere in the app
  res.setHeader("Set-Cookie", [
    clearCookie("refresh_token"),
    clearCookie("access_token"),
    clearCookie("id_token"),
    clearCookie("alice_session"),
  ]);

  // Microsoft logout with automatic return
  const logoutUrl =
    `https://login.microsoftonline.com/${encodeURIComponent(tenant)}` +
    `/oauth2/v2.0/logout?post_logout_redirect_uri=${encodeURIComponent(postLogout)}`;

  return res.redirect(302, logoutUrl);
}
