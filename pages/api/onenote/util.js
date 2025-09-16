// pages/api/onenote/util.js
export function getBearerFromReq(req) {
  const hdr = req.headers?.authorization || "";
  if (hdr) return hdr;
  const cookieToken = req.cookies?.access_token;
  return cookieToken ? `Bearer ${cookieToken}` : "";
}

async function graphFetch(url, opts = {}) {
  const r = await fetch(url, opts);
  const text = await r.text();
  try { return { ok: r.ok, status: r.status, json: text ? JSON.parse(text) : {} }; }
  catch { return { ok: r.ok, status: r.status, json: { raw: text } }; }
}

export async function graphGET(bearer, url) {
  return graphFetch(url, { headers: { Authorization: bearer } });
}
export async function graphPOST(bearer, url, body, headers = {}) {
  return graphFetch(url, { method: "POST",
    headers: { Authorization: bearer, ...headers },
    body });
}
export async function graphPATCH(bearer, url, bodyObj) {
  return graphFetch(url, { method: "PATCH",
    headers: {
      Authorization: bearer,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(bodyObj)
  });
}
export async function graphDELETE(bearer, url) {
  return graphFetch(url, { method: "DELETE", headers: { Authorization: bearer } });
}

// Lookup helpers
export async function findNotebook(bearer, notebookName) {
  const nb = await graphGET(bearer, "https://graph.microsoft.com/v1.0/me/onenote/notebooks?$select=id,displayName");
  if (!nb.ok) throw new Error(`graph GET notebooks -> ${nb.status}: ${JSON.stringify(nb.json)}`);
  const hit = (nb.json.value || []).find(n => (n.displayName || "").trim().toLowerCase() === notebookName.trim().toLowerCase());
  if (!hit) throw new Error(`Notebook not found: ${notebookName}`);
  return hit;
}

export async function ensureSection(bearer, notebookId, sectionName) {
  // try to find
  const sec = await graphGET(bearer, `https://graph.microsoft.com/v1.0/me/onenote/notebooks/${encodeURIComponent(notebookId)}/sections?$select=id,displayName`);
  if (!sec.ok) throw new Error(`graph GET sections -> ${sec.status}: ${JSON.stringify(sec.json)}`);
  const existing = (sec.json.value || []).find(s => (s.displayName || "").trim().toLowerCase() === sectionName.trim().toLowerCase());
  if (existing) return existing;

  // create (OneNote sections create via POST to /sections with JSON { displayName })
  const created = await graphPOST(
    bearer,
    `https://graph.microsoft.com/v1.0/me/onenote/notebooks/${encodeURIComponent(notebookId)}/sections`,
    JSON.stringify({ displayName: sectionName }),
    { "Content-Type": "application/json" }
  );
  if (!created.ok) throw new Error(`graph POST create section -> ${created.status}: ${JSON.stringify(created.json)}`);
  return created.json; // should contain id, displayName
}
