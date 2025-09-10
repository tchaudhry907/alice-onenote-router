// lib/auth.js
import { kvGet, kvSet, kvDel } from './store.js';

const TENANT   = process.env.MS_TENANT || 'common';
const CLIENT_ID = process.env.MS_CLIENT_ID;
if (!CLIENT_ID) throw new Error('MS_CLIENT_ID is not set');

const DEVICE_SCOPES = (process.env.MS_DELEGATED_SCOPES ||
  'offline_access openid profile User.Read Notes.ReadWrite').trim();

const BASE = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0`;
const RT_KEY = 'graph:refresh_token';
const AT_KEY = 'graph:access_token';
const AT_TTL_SAFETY = 20;

async function tokenFromRefresh(refreshToken) {
  const params = new URLSearchParams();
  params.append('client_id', CLIENT_ID);
  params.append('grant_type', 'refresh_token');
  params.append('refresh_token', refreshToken);
  params.append('scope', DEVICE_SCOPES);
  const r = await fetch(`${BASE}/token`, { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: params });
  const txt = await r.text();
  if (!r.ok) throw new Error(`refresh_token failed (${r.status}): ${txt}`);
  return JSON.parse(txt);
}

async function tokenFromDeviceCode(deviceCode) {
  const params = new URLSearchParams();
  params.append('client_id', CLIENT_ID);
  params.append('grant_type', 'urn:ietf:params:oauth:grant-type:device_code');
  params.append('device_code', deviceCode);
  const r = await fetch(`${BASE}/token`, { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: params });
  const txt = await r.text();
  if (!r.ok) throw new Error(`device_code exchange failed (${r.status}): ${txt}`);
  return JSON.parse(txt);
}

export async function beginDeviceFlow() {
  const params = new URLSearchParams();
  params.append('client_id', CLIENT_ID);
  params.append('scope', DEVICE_SCOPES);
  const r = await fetch(`${BASE}/devicecode`, { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: params });
  const txt = await r.text();
  if (!r.ok) throw new Error(`devicecode start failed (${r.status}): ${txt}`);
  const data = JSON.parse(txt);
  await kvSet('graph:device_code', data.device_code, data.expires_in || 900);
  await kvSet('graph:device_poll_interval', String(data.interval || 5), data.expires_in || 900);
  return {
    user_code: data.user_code,
    verification_uri: data.verification_uri || data.verification_uri_complete || 'https://microsoft.com/devicelogin',
    expires_in: data.expires_in,
    message: data.message || `Go to ${data.verification_uri} and enter code ${data.user_code}`
  };
}

export async function pollDeviceFlow() {
  const deviceCode = await kvGet('graph:device_code');
  if (!deviceCode) return { ok:false, error:'No pending device flow. Start again.' };
  try {
    const data = await tokenFromDeviceCode(deviceCode);
    if (!data.access_token) return { ok:false, error:'No access_token in response' };
    await kvSet(RT_KEY, data.refresh_token, 60*60*24*90);
    await kvSet(AT_KEY, data.access_token, Math.max(0, (data.expires_in || 3600) - AT_TTL_SAFETY));
    return { ok:true };
  } catch (err) {
    const t = String(err.message || '');
    if (t.includes('authorization_pending')) return { ok:false, pending:true };
    return { ok:false, error:t };
  }
}

export async function getAccessToken() {
  const existing = await kvGet(AT_KEY);
  if (existing) return existing;
  const rt = await kvGet(RT_KEY);
  if (rt) {
    const data = await tokenFromRefresh(rt);
    await kvSet(AT_KEY, data.access_token, Math.max(0, (data.expires_in || 3600) - AT_TTL_SAFETY));
    if (data.refresh_token && data.refresh_token !== rt) {
      await kvSet(RT_KEY, data.refresh_token, 60*60*24*90);
    }
    return data.access_token;
  }
  const e = new Error('AUTH_REQUIRED'); e.auth_required = true; throw e;
}

export async function clearTokens() {
  await kvDel(AT_KEY); await kvDel(RT_KEY); await kvDel('graph:device_code'); await kvDel('graph:device_poll_interval');
}

export function requireAuth(req, res) {
  const expected = process.env.ACTION_BEARER_TOKEN;
  const auth = req.headers.authorization || '';
  if (!expected || !auth.startsWith('Bearer ') || auth.slice(7).trim() !== expected) {
    res.status(401).json({ ok:false, error:'Unauthorized' });
    return false;
  }
  return true;
}
