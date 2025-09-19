// lib/msgraph.js
// HARD KV-FREE build path: this file does not import any KV.
// It uses a runtime token from env for now (MS_GRAPH_ACCESS_TOKEN).
// After the build is green, we can switch back to reading the token from KV.

const ENV_TOKEN_NAME = "MS_GRAPH_ACCESS_TOKEN";

// ---- Access token from ENV (temporary) -------------------------------------
async function getAccessToken() {
  const t = process.env[ENV_TOKEN_NAME];
  if (t && typeof t === "string" && t.trim()) return t.trim();

  // As a fallback, allow JSON-ish env value like {"access_token":"..."}
  try {
    const maybe = JSON.parse(String(process.env.MS_GRAPH_TOKEN_JSON || "{}"));
    if (maybe && typeof maybe === "object" && maybe.access_token) return String(maybe.access_token);
  } catch {}

  throw new Error(
    `Access token not found. Set ${ENV_TOKEN_NAME} (or MS_GRAPH_TOKEN_JSON) in Vercel Env Variables.`
  );
}

// ---- Lower-level Graph fetch ------------------------------------------------
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

// ---- OneNote create & append ------------------------------------------------
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

// ---- Disabled list/search (NoGraphListCalls) --------------------------------
export async function searchPagesInSection() { throw new Error("searchPagesInSection disabled. Use known IDs."); }
export async function exchangeRefreshToken() { throw new Error("exchangeRefreshToken disabled. Use diagnostics re-auth flow."); }
export async function listNotebooks() { throw new Error("listNotebooks disabled. Use known IDs."); }
export async function listSectionsInNotebook() { throw new Error("listSectionsInNotebook disabled. Use known IDs."); }

// ---- Compatibility shims used elsewhere ------------------------------------
export const graphFetch = gfetch;
export async function createOneNotePageBySectionId(sectionId, html) {
  return createPageInSection(sectionId, html);
}
