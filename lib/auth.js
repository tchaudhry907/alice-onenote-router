// lib/auth.js
// App-only (client credentials) token for Microsoft Graph using your MS_* envs.

export async function getAccessToken() {
  const tenant = process.env.MS_TENANT || 'common';
  const clientId = process.env.MS_CLIENT_ID;
  const clientSecret = process.env.MS_CLIENT_SECRET;

  // For client-credentials, scope MUST be ".default"
  const scope = process.env.MS_SCOPES && process.env.MS_SCOPES.includes('/.default')
    ? process.env.MS_SCOPES
    : 'https://graph.microsoft.com/.default';

  if (!clientId || !clientSecret) {
    throw new Error('Missing MS_CLIENT_ID or MS_CLIENT_SECRET environment variables');
  }

  const url = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
  const params = new URLSearchParams();
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('scope', scope);                  // <- .default
  params.append('grant_type', 'client_credentials');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to fetch access token (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (!data.access_token) throw new Error('No access_token in Graph response');
  return data.access_token;
}

// Back-compat so older routes that import requireAuth still build
export function requireAuth(req, res) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader) {
    res.status(401).json({ ok: false, error: 'Unauthorized: missing auth header' });
    return false;
  }
  return true;
}
