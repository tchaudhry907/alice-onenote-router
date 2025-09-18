cat > ./lib/msgraph.v6.js <<'EOF'
// lib/msgraph.v6.js
// V6 Graph client used by the cron drain. Side-by-side with legacy lib/msgraph.js.
import { kv } from "@/lib/kv";
import { resolveSectionId } from "@/lib/sections.js";

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

async function getAccessTokenFromKV() {
  const keys = ["ms:access_token", "graph:access_token", "access_token"];
  for (const k of keys) {
    const v = await kv.get(k);
    if (!v) continue;
    if (typeof v === "string") return v;
    if (v && typeof v === "object" && v.access_token) return v.access_token;
  }
  const tokenObj = await kv.get("ms:token");
  if (tokenObj && tokenObj.access_token) return tokenObj.access_token;
  throw new Error("Graph access token not found in KV. Re-auth required.");
}

async function graphFetch(method, path, body, headers = {}) {
  const token = await getAccessTokenFromKV();
  const resp = await fetch(`${GRAPH_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...headers },
    body,
    cache: "no-store",
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    const err = new Error(`Graph ${method} ${path} failed: ${resp.status} ${resp.statusText} ${text}`);
    err.status = resp.status;
    throw err;
  }
  const ct = resp.headers.get("content-type") || "";
  return ct.includes("application/json") ? resp.json() : resp.text();
}

function escapeHtml(s) {
  return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

async function ensurePage(sectionId, pageKey, title) {
  try {
    const data = await graphFetch('GET', `/me/onenote/sections/${encodeURIComponent(sectionId)}/pages?$search=${encodeURIComponent(pageKey)}`);
    if (data?.value?.length) return data.value[0].id;
  } catch {}
  const seedHtml = \`<html><head><title>\${escapeHtml(title || pageKey)}</title></head><body><h1>\${escapeHtml(title || pageKey)}</h1><hr/></body></html>\`;
  const created = await graphFetch('POST', `/me/onenote/sections/${encodeURIComponent(sectionId)}/pages`, seedHtml, { 'Content-Type': 'text/html' });
  return created.id || (created?.value && created.value[0]?.id) || null;
}

async function appendToPage(pageId, htmlFragment) {
  const patch = [{ target: 'body', action: 'append', content: htmlFragment }];
  await graphFetch('PATCH', `/me/onenote/pages/${encodeURIComponent(pageId)}/content`, JSON.stringify(patch), { 'Content-Type': 'application/json' });
}

async function createPage(sectionId, title, innerHtml) {
  const fullHtml = \`<html><head><title>\${escapeHtml(title || 'Log')}</title></head><body>\${innerHtml}</body></html>\`;
  const created = await graphFetch('POST', `/me/onenote/sections/${encodeURIComponent(sectionId)}/pages`, fullHtml, { 'Content-Type': 'text/html' });
  return created.id || (created?.value && created.value[0]?.id) || null;
}

async function postPayload(payload) {
  const { route, title, html, appendTo } = payload || {};
  if (!route?.sectionName) throw new Error("postPayload: missing route.sectionName");
  const sectionId = resolveSectionId(route.sectionName);
  if (!sectionId) throw new Error(\`postPayload: unknown section "\${route.sectionName}"\`);
  if (appendTo?.pageKey) {
    const pageId = await ensurePage(sectionId, appendTo.pageKey, appendTo.pageKey);
    await appendToPage(pageId, html);
    return { mode: 'append', pageId, section: route.sectionName };
  } else {
    const pageId = await createPage(sectionId, title, html);
    return { mode: 'create', pageId, section: route.sectionName };
  }
}

export const graphClient = { postPayload };
EOF
