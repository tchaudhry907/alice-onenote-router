import crypto from "crypto";

const TENANT = process.env.MS_TENANT || "consumers";
const CLIENT_ID = process.env.MS_CLIENT_ID;
const REDIRECT_URI = process.env.REDIRECT_URI;
const BASE = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize`;

// The minimal scopes we need now (can grow later)
const SCOPE = [
  "openid",
  "profile",
  "offline_access",
  "Notes.ReadWrite.All"
].join(" ");

export default async function handler(req, res) {
  if (!CLIENT_ID || !REDIRECT_URI) {
    return res.status(500).send("Missing required environment variables.");
  }

  // Fresh state each attempt
  const state = crypto.randomUUID();

  // Set state cookie
  res.setHeader("Set-Cookie", [
    `state=${state}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=900` // 15 min
  ]);

  const url = new URL(BASE);
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account"); // clearer in testing

  return res.redirect(302, url.toString());
}
