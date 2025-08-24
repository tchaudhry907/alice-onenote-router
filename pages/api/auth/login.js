// pages/api/auth/login.js
import crypto from "crypto";

// Helpers
function b64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function sha256b64url(str) {
  return b64url(crypto.createHash("sha256").update(str).digest());
}

export default async function handler(_req, res) {
  // Stronger verifier length (PKCE spec: 43–128 chars). 64 bytes => 86 chars.
  const code_verifier = b64url(crypto.randomBytes(64));
  const code_challenge = sha256b64url(code_verifier);

  // Tie the flow together with a flowId and use it as state
  const flowId = crypto.randomBytes(16).toString("hex");
  const state = flowId;

  const cookieFlags = "Path=/; HttpOnly; Secure; SameSite=Lax";
  res.setHeader("Set-Cookie", [
    `pkce_verifier=${code_verifier}; ${cookieFlags}; Max-Age=300`,
    `oauth_state=${state}; ${cookieFlags}; Max-Age=300`,
    `flow=${flowId}; ${cookieFlags}; Max-Age=300`,
  ]);

  const params = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID,
    response_type: "code",
    redirect_uri: `${process.env.APP_BASE_URL}/api/auth/callback`,
    response_mode: "query",
    scope: "openid profile offline_access User.Read Notes.ReadWrite.All",
    code_challenge,
    code_challenge_method: "S256",
    state,
  });

  // IMPORTANT: this must be the same hostname as APP_BASE_URL so cookies are returned
  const authUrl = `https://login.microsoftonline.com/${process.env.MS_TENANT}/oauth2/v2.0/authorize?${params}`;
  res.redirect(authUrl);
}
