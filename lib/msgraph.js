// lib/msgraph.js
// Minimal MS Graph helpers + stubs to satisfy legacy imports.
// Fast-path create uses sectionId and a KV-stored access token.

import { kv } from "@/lib/kv";

// ---- Access token from KV ---------------------------------------------------

async function getAccessToken() {
  // Try common keys we’ve been using
  const keys = ["ms:access_token", "graph:access_token", "access_token"];
  for (const k of keys) {
    const v = await kv.get(k);
    if (!v) continue;
    if (typeof v === "string") return v;
    if (v && typeof v === "object" && v.access_token) return v.access_token;
  }
  throw new Error("No Graph access token found in KV");
}

// ---- Generic fetch wrapper --------------------------------------------------

export async function graphFetch(url, opts = {}) {
  const token = await getAccessToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    ...(opts.headers || {}),
  };
  const res = await fetch(url, { ...opts, headers, cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Graph ${res.status} ${res.statusText}: ${text?.slice(0, 500)}`);
  }
  return res;
}

// ---- OneNote: create page by sectionId (FAST PATH) --------------------------

export async function createOneNotePageBySectionId(sectionId, html) {
  // OneNote create page: POST /me/onenote/sections/{id}/pages (multipart/related)
  const boundary = "----alice-one-boundary-" + Math.random().toString(36).slice(2);

  const body =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="Presentation"\r\n` +
    `Content-Type: text/html\r\n\r\n` +
    `${html}\r\n` +
    `--${boundary}--`;

  const res = await graphFetch(
    `https://graph.microsoft.com/v1.0/me/onenote/sections/${encodeURIComponent(sectionId)}/pages`,
    {
      method: "POST",
      headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
      body,
    }
  );
  return res.json();
}

// ============================================================================
// Legacy compatibility stubs (used by older endpoints like /api/onenote/search,
// /api/onenote/sections-in-notebook, /api/onenote/sections).
// We’re not using these in the NoGraphListCalls fast path, but leaving them
// here prevents build errors if those files still import them.
// ============================================================================

/**
 * exchangeRefreshToken(refresh_token)
 * Stub to satisfy legacy imports. We don’t need refresh here for fast-path.
 * If an old route calls this, we throw a clear error so the response explains why.
 */
export async function exchangeRefreshToken(refresh_token) {
  throw new Error(
    "exchangeRefreshToken is disabled in NoGraphListCalls fast path. Use /debug/diagnostics to refresh and seed tokens."
  );
}

// Optional: If other legacy code expects these, keep harmless stubs:
export async function listNotebooks() {
  throw new Error("listNotebooks is disabled (NoGraphListCalls). Use known IDs.");
}
export async function listSectionsInNotebook(/* notebookId */) {
  throw new Error("listSectionsInNotebook is disabled (NoGraphListCalls). Use known IDs.");
}
