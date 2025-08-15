// pages/api/auth/login.js
import crypto from "crypto";

const AUTH_BASE = "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize";

export default function handler(req, res) {
  // short-lived PKCE verifier (we're not storing it long-term here for the demo)
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const params = new URLSearchParams({
    client_id: process.env.OAUTH_CLIENT_ID,
    response_type: "code",
    redirect_uri: process.env.REDIRECT_URI,
    response_mode: "query",
    scope: [
      "openid",
      "profile",
      "offline_access",
      "User.Read",
      "Notes.ReadWrite.All",
    ].join(" "),
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  // (Optional) set a cookie with the verifier if you plan to redeem it in the callback
  res.setHeader(
    "Set-Cookie",
    `pkce_verifier=${verifier}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=300`
  );

  res.redirect(`${AUTH_BASE}?${params.toString()}`);
}
