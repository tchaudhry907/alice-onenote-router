// lib/msgraph.js
// Minimal MS Graph helpers + stubs to satisfy legacy imports.
// Fast-path create uses sectionId and a KV-stored access token.

import { kv } from "@/lib/kv";

// ---- Access token from KV ---------------------------------------------------

async function getAccessToken() {
  const keys = ["ms:access_token", "graph:access_token", "access_token"];
  for (const k of keys) {
    const v = await kv.get(k);
    if (!v) continue;
    if (typeof v === "string") return v;
    if (v && typeof v === "object" && v.access_token) return v.access_token;
  }
  const tokenObj = await kv.get("ms:token");
  if (tokenObj && tokenObj.access_token) return tokenObj.access_token;

  throw new Error("Access token not found in KV. Use diagnostics to refresh/seed.");
}

// ---- HTTP helper ------------------------------------------------------------

async function gfetch(method, path, body, headers = {}) {
  const token = await getAccessToken();
  const url = `https://graph.microsoft.com/v1.0${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...headers,
    },
    body,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`Graph ${method} ${path} failed: ${res.status} ${res.statusText} ${text}`);
    err.status = res.status;
    throw err;
  }
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return await res.json();
  }
  return await res.text();
}

// ---- OneNote create ---------------------------------------------------------

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

// ---- OneNote append ---------------------------------------------------------

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

// ---- Stubs / compatibility --------------------------------------------------

export async function searchPagesInSection() {
  throw new Error("searchPagesInSection disabled. Use probe/known IDs.");
}

export async function exchangeRefreshToken() {
  throw new Error("exchangeRefreshToken disabled. Use diagnostics re-auth flow.");
}

export async function listNotebooks() {
  throw new Error("listNotebooks disabled. Use known IDs.");
}

export async function listSectionsInNotebook() {
  throw new Error("listSectionsInNotebook disabled. Use known IDs.");
}

// ---- Compatibility shims ----------------------------------------------------

// Some code expects a lower-level fetch helper:
export const graphFetch = gfetch;

// Some code expects this alias instead of createPageInSection:
export async function createOneNotePageBySectionId(sectionId, html) {
  return createPageInSection(sectionId, html);
}
