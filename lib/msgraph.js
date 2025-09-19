// lib/msgraph.js — NO '@vercel/kv' anywhere.
// Uses our local stub so imports resolve cleanly during build.

import { kv } from "@/lib/kv-stub";

const TENANT = process.env.MS_GRAPH_TENANT_ID || "common";
const CLIENT_ID = process.env.MS_GRAPH_CLIENT_ID;
const CLIENT_SECRET = process.env.MS_GRAPH_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || process.env.MS_REDIRECT_URI;

const TOKEN_KEY = "ms:token"; // { access_token, refresh_token, expires_at:number }

const nowSec = () => Math.floor(Date.now() / 1000);
const form = (o) =>
  Object.entries(o)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v ?? "")}`)
    .join("&");

async function tokenEndpoint(body) {
  const url = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form(body),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Token endpoint ${res.status}: ${text}`);
  return JSON.parse(text);
}

// ----- Public: exchange auth code for tokens (stores refresh in KV) ----------
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

// ----- Internal: refresh using KV -------------------------------------------
async function refreshUsingKV() {
  const current = (await kv.get(TOKEN_KEY)) || {};
  const refresh_token = current.refresh_token;
  if (!refresh_token) {
    throw new Error("No refresh_token in KV. Authorize first (login flow).");
  }
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

// ----- Public: get a fresh access token -------------------------------------
export async function getAccessToken() {
  const r = (await kv.get(TOKEN_KEY)) || {};
  if (r.access_token && r.expires_at && r.expires_at > nowSec()) return r.access_token;
  const n = await refreshUsingKV();
  return n.access_token;
}

// ----- Public: low-level Graph fetch (what routes import as graphFetch) ------
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

// ----- Public: create a OneNote page by sectionId (what create-fast uses) ----
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

// ----- Compatibility stubs so legacy imports resolve ------------------------
export async function searchPagesInSection() {
  throw new Error("searchPagesInSection is disabled in this fast-path build.");
}
export async function exchangeRefreshToken() {
  throw new Error("Use the login/callback flow; direct exchangeRefreshToken is disabled.");
}
