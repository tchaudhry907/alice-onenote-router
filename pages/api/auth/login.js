// pages/api/auth/login.js
import crypto from "crypto";

function b64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function serializeCookie(name, value, { maxAge, path = "/", httpOnly = true, secure = true, sameSite = "lax" } = {}) {
  const enc = encodeURIComponent;
  let cookie = `${name}=${enc(value)}`;
  if (maxAge !== undefined) cookie += `; Max-Age=${Math.floor(maxAge)}`;
  if (path) cookie += `; Path=${path}`;
  if (httpOnly) cookie += `; HttpOnly`;
  if (secure) cookie += `; Secure`;
  if (sameSite) cookie += `; SameSite=${sameSite}`;
  return cookie;
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Use GET" });

  const {
    MS_TENANT = "common",
    MS_CLIENT_ID,
    MS_REDIRECT_URI = "https://alice-onenote-router.vercel.app/api/auth/callback",
  } = process.env;

  if (!MS_CLIENT_ID) return res.status(500).json({ ok: false, error: "MS_CLIENT_ID not configured" });

  // Create PKCE pair
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());

  // CSRF state
  const state = b64url(crypto.randomBytes(16));

  // Persist short-lived cookies for verifier & state (10 minutes)
  res.setHeader("Set-Cookie", [
    serializeCookie("pkce_verifier", verifier, { maxAge: 600 }),
    serializeCookie("oauth_state", state, { maxAge: 600 }),
  ]);

  const scope = [
    "offline_access",
    "openid",
    "profile",
    "User.Read",
    "Notes.ReadWrite",
    "Notes.Create",
    "Files.ReadWrite.All",
  ].join(" ");

  const authorize = new URL(`https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/authorize`);
  authorize.searchParams.set("client_id", MS_CLIENT_ID);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("redirect_uri", MS_REDIRECT_URI);
  authorize.searchParams.set("response_mode", "query");
  authorize.searchParams.set("scope", scope);
  authorize.searchParams.set("code_challenge", challenge);
  authorize.searchParams.set("code_challenge_method", "S256");
  authorize.searchParams.set("state", state);

  res.writeHead(302, { Location: authorize.toString() });
  res.end();
}
