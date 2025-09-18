// /lib/msgraph.js
//
// Purpose:
// - Provide a Microsoft Graph client with auto refresh-token handling
// - Expose postPayload(payload) for drain.js
// - Support append-to-page (monthly/weekly) or create-new if page not found
//
// Env vars required:
// MS_GRAPH_CLIENT_ID, MS_GRAPH_CLIENT_SECRET, MS_GRAPH_TENANT_ID
// MS_GRAPH_REFRESH_TOKEN (seed), KV_URL / KV_REST_API_URL / KV_REST_API_TOKEN
//
// Dependencies: axios
//

import axios from 'axios';
import crypto from 'crypto';

import { kv } from '@vercel/kv'; // fallback; project may wrap with '@/lib/kv'

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

async function getAccessToken() {
  // Check KV first
  let tokenData = await kv.get('ms:token');
  if (tokenData && tokenData.access_token && Date.now() < tokenData.expires_at - 60000) {
    return tokenData.access_token;
  }

  // Need to refresh
  const refresh_token = tokenData?.refresh_token || process.env.MS_GRAPH_REFRESH_TOKEN;
  if (!refresh_token) {
    throw new Error('Missing refresh_token. Re-auth required.');
  }

  const resp = await axios.post(
    `https://login.microsoftonline.com/${process.env.MS_GRAPH_TENANT_ID}/oauth2/v2.0/token`,
    new URLSearchParams({
      client_id: process.env.MS_GRAPH_CLIENT_ID,
      client_secret: process.env.MS_GRAPH_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token,
      scope: 'https://graph.microsoft.com/.default offline_access',
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  const data = resp.data;
  const expires_at = Date.now() + data.expires_in * 1000;
  const newTokenData = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refresh_token,
    expires_at,
  };
  await kv.set('ms:token', newTokenData);

  return newTokenData.access_token;
}

async function graphRequest(method, url, body) {
  const token = await getAccessToken();
  try {
    const resp = await axios({
      method,
      url: `${GRAPH_BASE}${url}`,
      headers: { Authorization: `Bearer ${token}` },
      data: body,
    });
    return resp.data;
  } catch (err) {
    if (err?.response?.status === 401 || err?.response?.status === 403) {
      // Retry once with fresh token
      await kv.del('ms:token');
      const retryToken = await getAccessToken();
      const resp2 = await axios({
        method,
        url: `${GRAPH_BASE}${url}`,
        headers: { Authorization: `Bearer ${retryToken}` },
        data: body,
      });
      return resp2.data;
    }
    throw err;
  }
}

// Helper: find or create page by pageKey
async function ensurePage(sectionId, pageKey, title) {
  // Try to find existing page by searching
  try {
    const pages = await graphRequest(
      'GET',
      `/me/onenote/sections/${sectionId}/pages?$search=${encodeURIComponent(pageKey)}`
    );
    if (pages?.value?.length) {
      return pages.value[0].id;
    }
  } catch (_) {
    // ignore, fall through to create
  }

  // Create new page
  const html = `
    <html>
      <head>
        <title>${escapeHtml(title || pageKey)}</title>
      </head>
      <body>
        <h1>${escapeHtml(title || pageKey)}</h1>
      </body>
    </html>
  `;
  const created = await graphRequest(
    'POST',
    `/me/onenote/sections/${sectionId}/pages`,
    html
  );
  return created.id;
}

// Post payload (append or create page)
async function postPayload(payload) {
  const { route, title, html, appendTo } = payload;
  if (!route?.sectionName) throw new Error('Missing sectionName in payload.route');

  // Look up sectionId from lib/sections.js
  const sections = await import('@/lib/sections.js');
  const sectionId = sections.SECTIONS[route.sectionName];
  if (!sectionId) throw new Error(`Unknown section: ${route.sectionName}`);

  // Resolve pageId
  let pageId = null;
  if (appendTo?.pageKey) {
    pageId = await ensurePage(sectionId, appendTo.pageKey, appendTo.pageKey);
  }

  if (pageId) {
    // Append to existing page
    const patch = [
      {
        target: 'body',
        action: 'append',
        content: html,
      },
    ];
    await graphRequest('PATCH', `/me/onenote/pages/${pageId}/content`, patch);
    return { mode: 'append', pageId, section: route.sectionName };
  } else {
    // Create new page
    const fullHtml = `
      <html>
        <head>
          <title>${escapeHtml(title)}</title>
        </head>
        <body>
          ${html}
        </body>
      </html>
    `;
    const created = await graphRequest(
      'POST',
      `/me/onenote/sections/${sectionId}/pages`,
      fullHtml
    );
    return { mode: 'create', pageId: created.id, section: route.sectionName };
  }
}

function escapeHtml(s) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export const graphClient = {
  postPayload,
};
