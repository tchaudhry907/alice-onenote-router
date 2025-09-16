// lib/graph.js
export function getBearer(req) {
  const hdr = req.headers?.authorization;
  if (hdr && /^Bearer\s+/i.test(hdr)) return hdr;
  const cookieToken = req.cookies?.access_token;
  return cookieToken ? `Bearer ${cookieToken}` : "";
}

async function graphFetch(url, { bearer, method = "GET", headers = {}, body } = {}) {
  if (!bearer) throw new Error("No access token (header or cookie)");
  const res = await fetch(url, {
    method,
    headers: { Authorization: bearer, ...headers },
    body,
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!res.ok) {
    throw new Error(`graph ${method} ${new URL(url).pathname} -> ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

export async function graphGET(url, bearer) {
  return graphFetch(url, { bearer, method: "GET" });
}

export async function graphPOST(url, bearer, body, headers = {}) {
  return graphFetch(url, { bearer, method: "POST", body, headers });
}

export async function resolveNotebookSection({ bearer, notebookName, sectionName, createIfMissing = false }) {
  // 1) notebooks
  const nbJson = await graphGET(
    "https://graph.microsoft.com/v1.0/me/onenote/notebooks?$select=id,displayName",
    bearer
  );
  const notebook = (nbJson.value || []).find(
    n => (n.displayName || "").trim().toLowerCase() === notebookName.trim().toLowerCase()
  );
  if (!notebook) throw new Error(`Notebook not found: ${notebookName}`);

  // 2) sections
  let secJson = await graphGET(
    `https://graph.microsoft.com/v1.0/me/onenote/notebooks/${encodeURIComponent(notebook.id)}/sections?$select=id,displayName`,
    bearer
  );
  let section = (secJson.value || []).find(
    s => (s.displayName || "").trim().toLowerCase() === sectionName.trim().toLowerCase()
  );

  // 3) create section if asked
  if (!section && createIfMissing) {
    const created = await graphPOST(
      `https://graph.microsoft.com/v1.0/me/onenote/notebooks/${encodeURIComponent(notebook.id)}/sections`,
      bearer,
      JSON.stringify({ displayName: sectionName }),
      { "Content-Type": "application/json" }
    );
    section = created; // has id/displayName
  }

  if (!section) throw new Error(`Section not found: ${sectionName}`);
  return { notebook, section };
}

export function buildOneNoteMultipart({ title, html }) {
  const boundary = "----AliceRouterBoundary" + Math.random().toString(36).slice(2);
  const safeTitle = String(title || "Untitled")
    .replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
  const htmlDoc = `<!DOCTYPE html><html><head><title>${safeTitle}</title></head><body>${html || "<p></p>"}</body></html>`;
  const body =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="Presentation"\r\n` +
    `Content-Type: text/html\r\n\r\n` +
    htmlDoc + `\r\n` +
    `--${boundary}--\r\n`;
  return { boundary, body };
}

export async function createOneNotePage({ bearer, sectionId, title, html }) {
  const { boundary, body } = buildOneNoteMultipart({ title, html });
  const created = await graphPOST(
    `https://graph.microsoft.com/v1.0/me/onenote/sections/${encodeURIComponent(sectionId)}/pages`,
    bearer,
    body,
    { "Content-Type": `multipart/form-data; boundary=${boundary}` }
  );
  return created;
}
