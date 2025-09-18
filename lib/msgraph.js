// lib/msgraph.js
// Minimal Graph API helper for OneNote page creation.
// We avoid heavy "list" calls — this is only for posting pages.

import { kv } from '@vercel/kv';

// Exchange refresh token for a new access token if needed
export async function getGraphAccessToken() {
  const cached = await kv.get('graph:access_token');
  if (cached) return cached;

  const refreshToken = await kv.get('graph:refresh_token');
  if (!refreshToken) throw new Error('No refresh token in KV');

  const params = new URLSearchParams();
  params.append('client_id', process.env.MS_GRAPH_CLIENT_ID);
  params.append('client_secret', process.env.MS_GRAPH_CLIENT_SECRET);
  params.append('scope', 'https://graph.microsoft.com/.default');
  params.append('grant_type', 'refresh_token');
  params.append('refresh_token', refreshToken);

  const resp = await fetch(`https://login.microsoftonline.com/${process.env.MS_GRAPH_TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Failed to refresh Graph token: ${resp.status} ${errText}`);
  }

  const data = await resp.json();
  const { access_token, expires_in, refresh_token: newRefresh } = data;

  await kv.set('graph:access_token', access_token, { ex: expires_in - 60 });
  if (newRefresh) await kv.set('graph:refresh_token', newRefresh);

  return access_token;
}

// Create a OneNote page
export async function createPage({ sectionId, title, html }) {
  const token = await getGraphAccessToken();
  const resp = await fetch(`https://graph.microsoft.com/v1.0/me/onenote/sections/${sectionId}/pages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/xhtml+xml',
    },
    body: `<!DOCTYPE html><html><head><title>${title}</title></head><body>${html}</body></html>`,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Graph createPage failed: ${resp.status} ${errText}`);
  }

  return resp.json();
}
