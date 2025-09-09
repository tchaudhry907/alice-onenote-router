// lib/auth.js
// Helper to get a Microsoft Graph access token using client credentials flow

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
