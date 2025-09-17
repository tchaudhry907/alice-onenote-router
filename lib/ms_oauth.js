// lib/ms_oauth.js — minimal MS OAuth refresh helper (client credentials + refresh_token)

const TENANT = process.env.MS_TENANT_ID || process.env.AZURE_TENANT_ID || "common";
const CLIENT_ID = process.env.MS_CLIENT_ID || process.env.AZURE_CLIENT_ID;
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET || process.env.AZURE_CLIENT_SECRET;

// Scopes for Graph
const SCOPE = "https://graph.microsoft.com/.default offline_access openid profile";

export async function refreshWithRefreshToken(refresh_token) {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("Missing MS_CLIENT_ID / MS_CLIENT_SECRET env vars");
  }
  const url = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token,
    scope: SCOPE,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status} ${res.statusText}: ${text}`);
  }
  let json;
  try { json = JSON.parse(text); } catch { throw new Error("Token refresh: invalid JSON"); }

  const { access_token, refresh_token: new_refresh_token, token_type, expires_in } = json;
  if (!access_token) throw new Error("Token refresh returned no access_token");
  return { access_token, refresh_token: new_refresh_token || refresh_token, token_type, expires_in };
}
