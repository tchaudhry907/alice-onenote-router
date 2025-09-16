// lib/auth-device.js
import { get as kvGet, set as kvSet, del as kvDel } from "./kv.js";

const TENANT = process.env.AZURE_TENANT_ID || process.env.MS_TENANT || "common";
const CLIENT_ID = process.env.AZURE_CLIENT_ID || process.env.MS_CLIENT_ID;
const SCOPES = process.env.GRAPH_SCOPES || "offline_access openid profile Notes.ReadWrite.All";

function key(prefix, bearer) {
  const b = bearer || "default";
  return `auth:${b}:${prefix}`;
}

async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    const msg = data?.error_description || data?.error || text || `HTTP ${res.status}`;
    const e = new Error(msg);
    e.status = res.status;
    e.payload = data;
    throw e;
  }
  return data;
}

export async function resetDeviceFlow({ bearer }) {
  await kvDel(key("device", bearer));
  await kvDel(key("tokens", bearer));
  return { cleared: true };
}

export async function beginDeviceFlow({ bearer }) {
  if (!CLIENT_ID) throw new Error("Missing AZURE_CLIENT_ID (or MS_CLIENT_ID) env");
  const url = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/devicecode`;
  const body = new URLSearchParams({ client_id: CLIENT_ID, scope: SCOPES });

  const data = await fetchJSON(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  await kvSet(key("device", bearer), {
    device_code: data.device_code,
    interval: data.interval || 5,
    expires_in: data.expires_in || 900,
    created_at: Date.now(),
  }, 1800);

  return {
    user_code: data.user_code,
    verification_uri: data.verification_uri || data.verification_uri_complete || "https://www.microsoft.com/link",
    expires_in: data.expires_in,
    message: data.message,
  };
}

export async function pollDeviceFlow({ bearer }) {
  const dev = await kvGet(key("device", bearer));
  if (!dev?.device_code) {
    return { ok: false, pending: true, error: "No device flow in progress" };
  }
  if (!CLIENT_ID) throw new Error("Missing AZURE_CLIENT_ID (or MS_CLIENT_ID) env");

  const url = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    client_id: CLIENT_ID,
    device_code: dev.device_code,
  });

  try {
    const tok = await fetchJSON(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    await kvSet(key("tokens", bearer), {
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      token_type: tok.token_type,
      scope: tok.scope,
      expires_in: tok.expires_in,
      obtained_at: Date.now(),
    }, 60 * 60 * 24 * 14);

    await kvDel(key("device", bearer));
    return { ok: true };
  } catch (e) {
    const code = e?.payload?.error || "";
    if (code === "authorization_pending" || code === "slow_down") {
      return { ok: false, pending: true };
    }
    if (code === "expired_token") {
      await kvDel(key("device", bearer));
      return { ok: false, pending: false, error: "expired_token" };
    }
    throw e;
  }
}
