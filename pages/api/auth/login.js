import crypto from "crypto";

export default async function handler(req, res) {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");

  res.setHeader("Set-Cookie", `pkce_verifier=${verifier}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=300`);

  const authUrl = new URL(`https://login.microsoftonline.com/${process.env.MS_TENANT_ID}/oauth2/v2.0/authorize`);
  authUrl.searchParams.set("client_id", process.env.MS_CLIENT_ID);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", process.env.REDIRECT_URI);
  authUrl.searchParams.set("response_mode", "query");
  authUrl.searchParams.set("scope", "openid profile offline_access Notes.ReadWrite.All");
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  res.redirect(authUrl.toString());
}
