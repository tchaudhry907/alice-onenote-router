// pages/api/auth/login.js
import crypto from "crypto";
import { serialize } from "cookie";

const AUTH_TENANT = "common"; // <-- use 'common' (supports personal + org accounts)
const AUTH_BASE = "https://login.microsoftonline.com";
const AUTH_URL = `${AUTH_BASE}/${AUTH_TENANT}/oauth2/v2.0/authorize`;

const clientId = process.env.MS_CLIENT_ID;
const redirectUri = process.env.REDIRECT_URI;

// Scopes needed for sign-in + OneNote
const scope = [
  "openid",
  "profile",
  "offline_access",
  "User.Read",
  "Notes.ReadWrite.All"
].join(" ");

export default async function handler(req, res) {
  // PKCE: code_verifier + code_challenge
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");

  // short-lived, httpOnly cookie to store the verifier
  res.setHeader("Set-Cookie", [
    serialize("pkce_verifier", verifier, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 300,
    }),
  ]);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  res.redirect(`${AUTH_URL}?${params.toString()}`);
}
