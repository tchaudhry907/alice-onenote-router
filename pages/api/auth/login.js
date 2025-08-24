// pages/api/auth/login.js
import crypto from "crypto";

const {
  MS_CLIENT_ID,
  MS_TENANT_ID,
  APP_BASE_URL,
} = process.env;

function base64url(buffer) {
  return buffer.toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function makeCookie(name, value, opts = {}) {
  const {
    httpOnly = true,
    secure = true,
    sameSite = "Lax",
    path = "/",
    maxAge, // seconds
  } = opts;

  const parts = [`${name}=${value}`];
  if (maxAge) parts.push(`Max-Age=${maxAge}`);
  if (path) parts.push(`Path=${path}`);
  if (sameSite) parts.push(`SameSite=${sameSite}`);
  if (secure) parts.push("Secure");
  if (httpOnly) parts.push("HttpOnly");
  return parts.join("; ");
}

export default async function handler(req, res) {
  try {
    if (!MS_CLIENT_ID || !MS_TENANT_ID || !APP_BASE_URL) {
      return res.status(500).json({ error: "Missing required env vars" });
    }

    // PKCE: create code_verifier & challenge
    const verifierBytes = crypto.randomBytes(32);
    const code_verifier = base64url(verifierBytes);
    const code_challenge = base64url(
      crypto.createHash("sha256").update(code_verifier).digest()
    );

    // state for CSRF
    const state = base64url(crypto.randomBytes(24));

    // Store short-lived cookies (5 minutes)
    res.setHeader("Set-Cookie", [
      makeCookie("pkce_verifier", code_verifier, { maxAge: 300 }),
      makeCookie("oauth_state", state, { maxAge: 300 }),
    ]);

    const scope = [
      "openid",
      "profile",
      "offline_access",
      "User.Read",
      "Notes.ReadWrite.All",
    ].join(" ");

    const authorizeUrl = new URL(
      `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/authorize`
    );
    authorizeUrl.searchParams.set("client_id", MS_CLIENT_ID);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("redirect_uri", `${APP_BASE_URL}/api/auth/callback`);
    authorizeUrl.searchParams.set("response_mode", "query");
    authorizeUrl.searchParams.set("scope", scope);
    authorizeUrl.searchParams.set("code_challenge", code_challenge);
    authorizeUrl.searchParams.set("code_challenge_method", "S256");
    authorizeUrl.searchParams.set("state", state);

    return res.redirect(authorizeUrl.toString());
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ error: "Login init failed" });
  }
}
