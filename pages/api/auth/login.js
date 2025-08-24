// pages/api/auth/login.js
import crypto from "crypto";

const APP_BASE_URL = process.env.APP_BASE_URL; // e.g. https://alice-onenote-router.vercel.app
const MS_TENANT = process.env.MS_TENANT;       // "consumers"
const MS_CLIENT_ID = process.env.MS_CLIENT_ID; // your app (client) id
const REDIRECT_URI = process.env.REDIRECT_URI; // https://alice-onenote-router.vercel.app/api/auth/callback

// One cookie name for the PKCE verifier
const PKCE_COOKIE = "pkce_verifier";

// Build a base64url encoder
function b64url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export default async function handler(req, res) {
  // --- Host normalization: always run on the production host ---
  // If this request hits a preview/alias host, bounce to APP_BASE_URL to keep cookies on one host.
  const currentHost = req.headers["host"];
  const baseHost = new URL(APP_BASE_URL).host;
  if (currentHost && baseHost && currentHost !== baseHost) {
    const url = new URL(req.url ?? "", `https://${baseHost}`);
    // Ensure we land back on /api/auth/login at the canonical host
    url.pathname = "/api/auth/login";
    // Preserve query if any
    return res.writeHead(307, { Location: url.toString() }).end();
  }

  // --- Generate PKCE pair ---
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());

  // Store verifier in a short‑lived, host‑only cookie
  // - host-only (no Domain) so it’s only valid for alice-onenote-router.vercel.app
  // - Secure; SameSite=Lax; HttpOnly to survive the Microsoft redirect
  res.setHeader("Set-Cookie", [
    `${PKCE_COOKIE}=${verifier}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
  ]);

  // --- Build /authorize URL ---
  const params = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    response_mode: "query",
    scope: "openid profile offline_access Notes.ReadWrite.All User.Read",
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  const authorizeUrl = `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/authorize?${params.toString()}`;

  return res.writeHead(302, { Location: authorizeUrl }).end();
}
