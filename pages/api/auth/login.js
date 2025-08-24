// pages/api/auth/login.js
import crypto from "crypto";

export default async function handler(req, res) {
  // Generate code_verifier and code_challenge
  const code_verifier = crypto.randomBytes(32).toString("base64url");
  const code_challenge = crypto
    .createHash("sha256")
    .update(code_verifier)
    .digest("base64url");

  // Store verifier in cookie for callback
  res.setHeader("Set-Cookie", [
    `pkce_verifier=${code_verifier}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=300`,
    `oauth_state=${crypto.randomBytes(16).toString("hex")}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=300`,
  ]);

  const params = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID,
    response_type: "code",
    redirect_uri: `${process.env.APP_BASE_URL}/api/auth/callback`,
    response_mode: "query",
    scope: "openid profile offline_access User.Read Notes.ReadWrite.All",
    code_challenge: code_challenge,
    code_challenge_method: "S256",
    state: "aliceRouter", // static for now; cookie covers replay
  });

  res.redirect(`https://login.microsoftonline.com/${process.env.MS_TENANT}/oauth2/v2.0/authorize?${params.toString()}`);
}
