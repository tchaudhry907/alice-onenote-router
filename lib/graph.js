// /lib/graph.js

// Pull a bearer either from the Authorization header or an access_token cookie.
export function getBearerFromReq(req) {
  const h = req.headers?.authorization || "";
  if (h && /^Bearer\s+/i.test(h)) return h;
  const ck = req.cookies?.access_token;
  if (ck) return `Bearer ${ck}`;
  return "";
}

export async function graphGET(url, bearer) {
  const r = await fetch(url, { headers: { Authorization: bearer } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`graph GET ${url} -> ${r.status}: ${JSON.stringify(j)}`);
  return j;
}

export async function graphPOST(url, bearer, body, headers = {}) {
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: bearer, ...headers },
    body,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`graph POST ${url} -> ${r.status}: ${JSON.stringify(j)}`);
  return j;
}

export async function findNotebookByName(bearer, name) {
  const list = await graphGET("https://graph.microsoft.com/v1.0/me/onenote/notebooks?$select=id,displayName", bearer);
  return (list.value || []).find(n => (n.displayName || "").trim().toLowerCase() === name.trim().toLowerCase());
}

export async function findSectionByName(bearer, notebookId, sectionName) {
  const list = await graphGET(
    `https://graph.microsoft.com/v1.0/me/onenote/notebooks/${encodeURIComponent(notebookId)}/sections?$select=id,displayName`,
    bearer
  );
  return (list.value || []).find(s => (s.displayName || "").trim().toLowerCase() === sectionName.trim().toLowerCase());
}

export function buildOneNoteHtmlMultipart({ title, html }) {
  const boundary = "----AliceBoundary" + Math.random().toString(36).slice(2);
  const doc = `<!DOCTYPE html><html><head><title>${escapeHtml(title || "Untitled")}</title></head><body>${html || "<p></p>"}</body></html>`;
  const body =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="Presentation"\r\n` +
    `Content-Type: text/html\r\n\r\n` +
    doc + `\r\n` +
    `--${boundary}--\r\n`;
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

export async function ensureSectionsBatch(bearer, notebookId, names = []) {
  if (!names?.length) return { created: [], skipped: [] };
  const existing = await graphGET(
    `https://graph.microsoft.com/v1.0/me/onenote/notebooks/${encodeURIComponent(notebookId)}/sections?$select=id,displayName`,
    bearer
  );
  const have = new Set((existing.value || []).map(s => (s.displayName || "").toLowerCase()));
  const toCreate = names.filter(n => !have.has(n.toLowerCase()));
  const created = [];
  for (const name of toCreate) {
    const j = await graphPOST(
      `https://graph.microsoft.com/v1.0/me/onenote/notebooks/${encodeURIComponent(notebookId)}/sections`,
      bearer,
      JSON.stringify({ displayName: name }),
      { "Content-Type": "application/json" }
    );
    created.push({ name, id: j?.id });
  }
  return { created, skipped: names.filter(n => have.has(n.toLowerCase())) };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
}
