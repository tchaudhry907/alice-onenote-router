// lib/msgraph.js
// Small helpers for Microsoft identity tokens + Graph calls.

export async function exchangeRefreshToken(refreshToken) {
  const {
    MS_TENANT,
    MS_CLIENT_ID,
    MS_CLIENT_SECRET,
    APP_BASE_URL,
    REDIRECT_URI,
  } = process.env;

  const url = `https://login.microsoftonline.com/${encodeURIComponent(
    MS_TENANT
  )}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    client_secret: MS_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    redirect_uri: REDIRECT_URI || `${APP_BASE_URL}/api/auth/callback`,
  });

  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = await r.json();
  if (!r.ok) {
    throw new Error(`refresh_token exchange failed: ${r.status} ${JSON.stringify(json)}`);
  }
  return json; // { access_token, expires_in, scope, token_type, ... }
}

export async function graphFetch(accessToken, url, init = {}) {
  const r = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return r;
}
