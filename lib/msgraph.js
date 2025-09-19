// lib/msgraph.js — NO '@vercel/kv' imports anywhere.
import { kv } from "@/lib/kv";

const TENANT = process.env.MS_GRAPH_TENANT_ID || "common";
const CLIENT_ID = process.env.MS_GRAPH_CLIENT_ID;
const CLIENT_SECRET = process.env.MS_GRAPH_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || process.env.MS_REDIRECT_URI;

const TOKEN_KEY = "ms:token"; // { access_token, refresh_token, expires_at:number }

const nowSec = () => Math.floor(Date.now() / 1000);
const enc = (o) => Object.entries(o).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v ?? "")}`).join("&");

async function tokenEndpoint(body) {
  const url = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: enc(body),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Token endpoint ${res.status}: ${text}`);
  return JSON.parse(text);
}

// ---- OAuth: auth code -> tokens (saves refresh in KV)
export async function exchangeAuthCodeForTokens(code) {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    throw new Error("Missing MS_GRAPH_CLIENT_ID / MS_GRAPH_CLIENT_SECRET / REDIRECT_URI.");
  }
  const data = await tokenEndpoint({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
  });
  const expires_at = nowSec() + Number(data.expires_in || 3600) - 60;
  const saved = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || (await kv.get(TOKEN_KEY))?.refresh_token || null,
    expires_at,
    token_type: data.token_type || "Bearer",
    scope: data.scope || "",
  };
  await kv.set(TOKEN_KEY, saved);
  return saved;
}

// ---- Refresh using KV-stored refresh_token
async function refreshUsingKV() {
  const current = (await kv.get(TOKEN_KEY)) || {};
  const refresh_token = current.refresh_token;
  if (!refresh_token) throw new Error("No refresh_token in KV. Visit /api/auth/login to authorize.");

  const data = await tokenEndpoint({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token,
    redirect_uri: REDIRECT_URI,
  });

  const expires_at = nowSec() + Number(data.expires_in || 3600) - 60;
  const merged = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refresh_token,
    expires_at,
    token_type: data.token_type || "Bearer",
    scope: data.scope || current.scope || "",
  };
  await kv.set(TOKEN_KEY, merged);
  return merged;
}

// ---- Get a valid access token (refresh if needed)
export async function getAccessToken() {
  const r = (await kv.get(TOKEN_KEY)) || {};
  if (r.access_token && r.expires_at && r.expires_at > nowSec()) return r.access_token;
  const n = await refreshUsingKV();
  return n.access_token;
}

// ---- Low-level Graph fetch (named export other files expect)
export async function graphFetch(method, path, body, headers = {}) {
  const token = await getAccessToken();
  const url = `https://graph.microsoft.com/v1.0${path}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...headers },
    body,
    cache: "no-store",
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Graph ${method} ${path} failed: ${res.status} ${res.statusText} ${t}`);
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

// ---- OneNote helper (named export other files expect)
export async function createOneNotePageBySectionId(sectionId, html) {
  if (!sectionId) throw new Error("Missing sectionId");
  if (!html) throw new Error("Missing html");
  return graphFetch(
    "POST",
    `/me/onenote/sections/${encodeURIComponent(sectionId)}/pages`,
    html,
    { "Content-Type": "text/html" }
  );
}

// ---- Kept for compatibility (some routes import these names)
export async function searchPagesInSection() { throw new Error("searchPagesInSection disabled for fast path."); }
export async function exchangeRefreshToken() { throw new Error("Use /api/auth/login + /api/auth/callback."); }
