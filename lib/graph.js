import fetch from "node-fetch";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const tokenEndpoint = (tenant) =>
  `https://login.microsoftonline.com/${tenant || "common"}/oauth2/v2.0/token`;

export async function exchangeCodeForTokens(code) {
  const body = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID,
    client_secret: process.env.MS_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.REDIRECT_URI,
  });

  const r = await fetch(tokenEndpoint(process.env.MS_TENANT), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) throw new Error(`Token exchange failed ${r.status}: ${await r.text()}`);
  return r.json(); // { access_token, refresh_token, id_token, ... }
}

export async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID,
    client_secret: process.env.MS_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: process.env.MS_SCOPES,
  });

  const r = await fetch(tokenEndpoint(process.env.MS_TENANT), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) throw new Error(`Refresh failed ${r.status}: ${await r.text()}`);
  return r.json();
}

export async function graphRequest(token, path, method = "GET", body, headers) {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}
