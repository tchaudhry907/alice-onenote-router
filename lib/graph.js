// lib/graph.js
const qs = (o) => new URLSearchParams(o);

function env(name, def = undefined) {
  const v = process.env[name];
  if (v === undefined || v === "") return def;
  return v;
}

export function getRedirectUri() {
  return env("REDIRECT_URI") || `${env("APP_BASE_URL")}/api/auth/callback`;
}

export function getScopes() {
  return env("MS_SCOPES", "offline_access Notes.ReadWrite User.Read");
}

export async function exchangeCodeForTokens(code) {
  const tenant = env("MS_TENANT", "common");
  const url = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
  const body = qs({
    client_id: env("MS_CLIENT_ID"),
    client_secret: env("MS_CLIENT_SECRET"),
    grant_type: "authorization_code",
    code,
    redirect_uri: getRedirectUri(),
    scope: getScopes()
  });

  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!r.ok) throw new Error(`token exchange failed ${r.status}`);
  return r.json();
}

export async function refreshAccessToken(refresh_token) {
  const tenant = env("MS_TENANT", "common");
  const url = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
  const body = qs({
    client_id: env("MS_CLIENT_ID"),
    client_secret: env("MS_CLIENT_SECRET"),
    grant_type: "refresh_token",
    refresh_token,
    scope: getScopes(),
    redirect_uri: getRedirectUri()
  });
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!r.ok) throw new Error(`refresh failed ${r.status}`);
  return r.json();
}
