cat > ./lib/msgraph.js <<'EOF'
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
  // Last-resort composite record: { access_token, refresh_token, expires_at }
  const tokenObj = await kv.get("ms:token");
  if (tokenObj && tokenObj.access_token) return tokenObj.access_token;

  throw new Error("Access token not found in KV. Use diagnostics to refresh/seed.");
}

// ---- HTTP helper ------------------------------------------------------------

async function gfetch(method, path, body, headers = {}) {
  const token = await getAccessToken();
  const url = `https://graph.microsoft.com/v1.0${path}`;
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...headers,
    },
    body,
  };
  const res = await fetch(url, { ...opts, headers, cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`Graph ${method} ${path} failed: ${res.status} ${res.statusText} ${text}`);
    err.status = res.status;
    throw err;
  }
  // Some OneNote endpoints return no JSON (204)
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return await res.json();
  }
  return await res.text();
}

// ---- OneNote create (fast path) --------------------------------------------
// Accepts raw HTML string for page creation in a known sectionId.
export async function createPageInSection(sectionId, html) {
  if (!sectionId) throw new Error("createPageInSection: missing sectionId");
  if (!html) throw new Error("createPageInSection: missing html");

  // text/html body works for simple creates
  const result = await gfetch(
    "POST",
    `/me/onenote/sections/${encodeURIComponent(sectionId)}/pages`,
    html,
    { "Content-Type": "text/html" }
  );

  // On success, Graph returns the created page JSON when JSON is requested;
  // when text/html is sent, some runtimes return empty string. Handle both.
  try {
    const parsed = typeof result === "string" ? JSON.parse(result) : result;
    return parsed?.id ? parsed : { ok: true, id: parsed?.id || null };
  } catch {
    return { ok: true, id: null };
  }
}

// ---- OneNote append (JSON patch) -------------------------------------------
// Append HTML fragment to an existing page body.
export async function appendToPage(pageId, htmlFragment) {
  if (!pageId) throw new Error("appendToPage: missing pageId");
  if (!htmlFragment) throw new Error("appendToPage: missing htmlFragment");

  const patch = [
    {
      target: "body",
      action: "append",
      content: htmlFragment,
    },
  ];

  // Some fetch environments require explicit JSON stringify here
  await gfetch("PATCH", `/me/onenote/pages/${encodeURIComponent(pageId)}/content`, JSON.stringify(patch), {
    "Content-Type": "application/json",
  });

  return { ok: true };
}

// ---- Stubs / placeholders kept for compatibility ---------------------------

/**
 * Legacy callers might expect a search; we avoid Graph list calls in this fast path.
 * If you need to find a page, call ensurePageIdFromClientUrl() by creating a probe page
 * and reading its clientUrl to extract the section/page id.
 */
export async function searchPagesInSection(/* sectionId, query */) {
  throw new Error("searchPagesInSection is disabled in NoGraphListCalls fast path.");
}

/**
 * Refresh-token exchange is intentionally not here (handled via a separate diagnostics flow).
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

// ---- Compatibility shims (to satisfy existing imports elsewhere) -----------

// Some routes import a lower-level fetch helper:
export const graphFetch = gfetch;

// Some routes expect this alias instead of createPageInSection:
export async function createOneNotePageBySectionId(sectionId, html) {
  return createPageInSection(sectionId, html);
}
EOF
