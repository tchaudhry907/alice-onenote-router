// lib/auth.js
// Provides both getAccessToken (client credentials for Graph)
// and requireAuth (legacy/session check)

export async function getAccessToken() {
  const tenant = process.env.AL_TENANT || 'common';
  const clientId = process.env.AL_CLIENT_ID;
  const clientSecret = process.env.AL_CLIENT_SECRET;
  const scope = process.env.AL_SCOPES || 'https://graph.microsoft.com/.default';

  if (!clientId || !clientSecret) {
    throw new Error('Missing AL_CLIENT_ID or AL_CLIENT_SECRET environment variables');
  }

  const url = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
  const params = new URLSearchParams();
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('scope', scope);
  params.append('grant_type', 'client_credentials');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch access token: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

export function requireAuth(req, res) {
  // Simple header check — update if you want to unify with ACTION_BEARER_TOKEN
  const authHeader = req.headers.authorization || '';
  if (!authHeader) {
    res.status(401).json({ ok: false, error: 'Unauthorized: missing auth header' });
    return false;
  }
  return true;
}
