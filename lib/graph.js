// lib/graph.js
import fetch from 'node-fetch';
import { kvGet } from './kv';

async function getBearer(req) {
  return (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
}

async function getAccessToken(req) {
  const bearer = await getBearer(req);
  if (!bearer) throw new Error('No bearer header');
  const bundle = await kvGet(`msgraph:${bearer}`);
  if (!bundle || !bundle.accessToken) throw new Error('No Graph session');
  if (bundle.expiresAt && Date.now() > bundle.expiresAt) {
    throw new Error('Graph token expired'); // (optional: perform refresh here)
  }
  return bundle.accessToken;
}

export async function graphGET(req, path) {
  const token = await getAccessToken(req);
  const r = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`graphGET ${path} -> ${r.status}: ${t}`);
  }
  return r.json();
}

export async function graphPOST(req, path, body, extraHeaders = {}) {
  const token = await getAccessToken(req);
  const r = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...extraHeaders
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`graphPOST ${path} -> ${r.status}: ${t}`);
  }
  return r.json();
}
