// lib/auth.js
// getAccessToken: Microsoft Graph client-credentials (robust env lookup)
// requireAuth: kept so older routes can import it without breaking

function getEnv(name, fallbacks = []) {
  const names = [name, ...fallbacks];
  for (const n of names) {
    const v = process.env[n];
    if (v && String(v).trim()) return String(v).trim();
  }
  return null;
}

export async function getAccessToken() {
  // Accept several aliases so you don't have to rename your Vercel vars
  const tenant = getEnv('AL_TENANT', ['MS_TENANT', 'AZURE_TENANT', 'TENANT_ID']) || 'common';
  const clientId = getEnv('AL_CLIENT_ID', ['MS_CLIENT_ID', 'AZURE_CLIENT_ID', 'CLIENT_ID']);
  const clientSecret = getEnv('AL_CLIENT_SECRET', ['MS_CLIENT_SECRET', 'AZURE_CLIENT_SECRET', 'CLIENT_SECRET']);
  const scope = getEnv('AL_SCOPES', ['MS_SCOPES', 'GRAPH_SCOPES']) || 'https://graph.microsoft.com/.default';

  const missing = [];
  if (!clientId) missing.push('AL_CLIENT_ID|MS_CLIENT_ID|AZURE_CLIENT_ID|CLIENT_ID');
  if (!clientSecret) missing.push('AL_CLIENT_SECRET|MS_CLIENT_SECRET|AZURE_CLIENT_SECRET|CLIENT_SECRET');
  if (missing.length) {
    throw new Error(`Missing env(s): ${missing.join(', ')}`);
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
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to fetch access token (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (!data.access_token) throw new Error('No access_token in Graph response');
  return data.access_token;
}

// Back-compat for any old routes importing this:
export function requireAuth(req, res) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader) {
    res.status(401).json({ ok: false, error: 'Unauthorized: missing auth header' });
    return false;
  }
  return true;
}
