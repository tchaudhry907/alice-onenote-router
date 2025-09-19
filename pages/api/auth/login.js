// pages/api/auth/login.js
// Redirects user to Microsoft identity platform for consent (auth code flow).

const TENANT = process.env.MS_GRAPH_TENANT_ID || "common";
const CLIENT_ID = process.env.MS_GRAPH_CLIENT_ID;
const REDIRECT_URI = process.env.REDIRECT_URI || process.env.MS_REDIRECT_URI;

// minimal scopes for OneNote w/ refresh
const SCOPES = (process.env.MS_SCOPES ||
  "offline_access Notes.ReadWrite openid profile").trim();

export default async function handler(req, res) {
  if (!CLIENT_ID || !REDIRECT_URI) {
    return res.status(500).json({ ok: false, error: "Missing MS_GRAPH_CLIENT_ID or REDIRECT_URI" });
  }
  const authUrl = new URL(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize`);
  authUrl.searchParams.set("client_id", CLIENT_ID);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("response_mode", "query");
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("state", "ok");

  res.writeHead(302, { Location: authUrl.toString() });
  res.end();
}
