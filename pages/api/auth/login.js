// pages/api/auth/login.js
import crypto from "crypto";

export default function handler(req, res) {
  const verifier = base64URLEncode(crypto.randomBytes(32));
  const challenge = base64URLEncode(sha256(verifier));

  // Set cookie
  res.setHeader("Set-Cookie", `pkce_verifier=${verifier}; Path=/; HttpOnly; Secure; SameSite=Lax`);

  const params = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID,
    response_type: "code",
    redirect_uri: process.env.APP_BASE_URL + "/api/auth/callback",
    response_mode: "query",
    scope: "offline_access Notes.ReadWrite User.Read",
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  res.redirect(`https://login.microsoftonline.com/${process.env.MS_TENANT}/oauth2/v2.0/authorize?${params.toString()}`);
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest();
}

function base64URLEncode(buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
