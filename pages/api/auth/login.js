// pages/api/auth/login.js
import crypto from "crypto";

function base64UrlEncode(buffer) {
  return buffer.toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export default async function handler(req, res) {
  // 1) Create PKCE verifier + challenge
  const verifier = base64UrlEncode(crypto.randomBytes(32));
  const challenge = base64UrlEncode(
    crypto.createHash("sha256").update(verifier).digest()
  );

  // 2) Store verifier in a short-lived, httpOnly, secure cookie
  const cookie = [
    `pkce_verifier=${verifier}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Secure",
    "Max-Age=600" // 10 minutes
  ].join("; ");
  res.setHeader("Set-Cookie", cookie);

  // 3) Build authorize URL
  const tenant = process.env.MS_TENANT || "common";
  const params = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID,
    response_type: "code",
    redirect_uri: process.env.REDIRECT_URI,
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
  });

  const authorizeUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;

  // 4) Redirect to Microsoft
  return res.redirect(authorizeUrl);
}
