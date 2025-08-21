import crypto from "crypto";
import { serialize } from "cookie";

// Force personal Microsoft accounts for sign-in:
const AUTH_TENANT = "consumers";
const AUTH_URL = `https://login.microsoftonline.com/${AUTH_TENANT}/oauth2/v2.0/authorize`;

const clientId = process.env.MS_CLIENT_ID;
const redirectUri = process.env.REDIRECT_URI;

const scope = [
  "openid",
  "profile",
  "offline_access",
  "User.Read",
  "Notes.ReadWrite.All"
].join(" ");

export default function handler(req, res) {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");

  res.setHeader("Set-Cookie", [
    serialize("pkce_verifier", verifier, {
      httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 300
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
