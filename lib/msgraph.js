// lib/msgraph.js
// Microsoft Graph helpers with refresh-token + KV cache.
// Uses your local lib/kv.js (NO @vercel/kv imports anywhere).

import { kv } from "@/lib/kv";

const TENANT = process.env.MS_GRAPH_TENANT_ID || "common"; // e.g. "common", "consumers", or your tenant GUID
const CLIENT_ID = process.env.MS_GRAPH_CLIENT_ID;
const CLIENT_SECRET = process.env.MS_GRAPH_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || process.env.MS_REDIRECT_URI;

// token storage keys (KV)
const TOKEN_KEY = "ms:token"; // { access_token, refresh_token, expires_at:number }

// --- helpers -----------------------------------------------------------------

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function formUrlEncode(params) {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v ?? "")}`)
    .join("&");
}

async function tokenEndpoint(body) {
  const url = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formUrlEncode(body),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Token endpoint error ${res.status}: ${text}`);
  }
  return JSON.parse(text);
}

// --- public: exchange auth code for refresh/access ---------------------------

export async function exchangeAuthCodeForTokens(code) {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    throw new Error("Missing MS_GRAPH_CLIENT_ID / MS_GRAPH_CLIENT_SECRET / REDIRECT_URI env vars.");
  }
  const data = await tokenEndpoint({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
  });

  const expires_at = nowSec() + Number(data.expires_in || 3600) - 60; // safety buffer
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

// --- internal: refresh using refresh_token -----------------------------------

async function refreshUsingKV() {
  const current = (await kv.get(TOKEN_KEY)) || {};
  const refresh_token = current.refresh_token;
  if (!refresh_token) {
    throw new Error("No refresh_token in KV. Visit /api/auth/login to authorize.");
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
    refresh_token: data.refresh_token || refresh_token, // rotate if provided
    expires_at,
    token_type: data.token_type || "Bearer",
    scope: data.scope || current.scope || "",
  };
  await kv.set(TOKEN_KEY, merged);
  return merged;
}

// --- public: get a valid access token (refresh if needed) --------------------

export async function getAccessToken() {
  const record = (await kv.get(TOKEN_KEY)) || {};
  if (record.access_token && record.expires_at && record.expires_at > nowSec()) {
    return record.access_token;
  }
  const refreshed = await refreshUsingKV();
  return refreshed.access_token;
}

// --- low-level Graph fetch ---------------------------------------------------

async function gfetch(method, path, body, headers = {}) {
  const token = await getAccessToken();
  const url = `https://graph.microsoft.com/v1.0${path}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...headers },
    body,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`Graph ${method} ${path} failed: ${res.status} ${res.statusText} ${text}`);
    err.status = res.status;
    throw err;
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

// --- OneNote helpers ---------------------------------------------------------

export async function createPageInSection(sectionId, html) {
  if (!sectionId) throw new Error("createPageInSection: missing sectionId");
  if (!html) throw new Error("createPageInSection: missing html");
  const result = await gfetch(
    "POST",
    `/me/onenote/sections/${encodeURIComponent(sectionId)}/pages`,
    html,
    { "Content-Type": "text/html" }
  );
  try {
    const parsed = typeof result === "string" ? JSON.parse(result) : result;
    return parsed?.id ? parsed : { ok: true, id: parsed?.id || null };
  } catch {
    return { ok: true, id: null };
  }
}

export async function appendToPage(pageId, htmlFragment) {
  if (!pageId) throw new Error("appendToPage: missing pageId");
  if (!htmlFragment) throw new Error("appendToPage: missing htmlFragment");
  const patch = [{ target: "body", action: "append", content: htmlFragment }];
  await gfetch(
    "PATCH",
    `/me/onenote/pages/${encodeURIComponent(pageId)}/content`,
    JSON.stringify(patch),
    { "Content-Type": "application/json" }
  );
  return { ok: true };
}

// disabled list/search (still avoiding heavy Graph list calls for V6 fast-path)
export async function searchPagesInSection() { throw new Error("searchPagesInSection disabled. Use known IDs."); }
export async function exchangeRefreshToken() { throw new Error("exchangeRefreshToken disabled here; use /api/auth/callback path."); }
export async function listNotebooks() { throw new Error("listNotebooks disabled. Use known IDs."); }
export async function listSectionsInNotebook() { throw new Error("listSectionsInNotebook disabled. Use known IDs."); }

// compatibility shims
export const graphFetch = gfetch;
export async function createOneNotePageBySectionId(sectionId, html) {
  return createPageInSection(sectionId, html);
}
