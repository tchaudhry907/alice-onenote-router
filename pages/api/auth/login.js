// pages/api/auth/login.js
import crypto from "crypto";

const TENANT = process.env.MS_TENANT_ID || process.env.MS_TENANT || "consumers";
const CLIENT_ID = process.env.MS_CLIENT_ID;
const REDIRECT_URI = process.env.REDIRECT_URI;    // e.g. https://alice-onenote-router.vercel.app/api/auth/callback
const APP_BASE_URL = process.env.APP_BASE_URL || ""; // optional, used for state return

// build random string
function randString(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}
// RFC7636 code challenge = base64url( SHA256(verifier) )
function codeChallenge(verifier) {
  const hash = crypto.createHash("sha256").update(verifier).digest();
  return Buffer.from(hash).toString("base64url");
}

export default async function handler(req, res) {
  try {
    if (!CLIENT_ID || !REDIRECT_URI) {
      res.status(500).json({ error: "Missing MS_CLIENT_ID or REDIRECT_URI env vars." });
      return;
    }

    const verifier = randString(64);
    const challenge = codeChallenge(verifier);
    const state = randString(24);

    // Store verifier + state in short‑lived, HttpOnly cookies
    res.setHeader("Set-Cookie", [
      `pkce_verifier=${verifier}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=300`,
      `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=300`,
      // also remember where to go after login (home by default)
      `post_login_redirect=${encodeURIComponent(APP_BASE_URL || "/")}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=300`
    ]);

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: "code",
      redirect_uri: REDIRECT_URI,
      response_mode: "query",
      scope: [
        "openid",
        "profile",
        "offline_access",
        "User.Read",
        "Notes.ReadWrite.All"
      ].join(" "),
      code_challenge: challenge,
      code_challenge_method: "S256",
      state
    });

    const authorizeUrl = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize?${params.toString()}`;
    return res.redirect(authorizeUrl);
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
}
