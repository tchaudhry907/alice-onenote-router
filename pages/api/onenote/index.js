// pages/api/onenote/index.js
// Unified OneNote API router (v2)
//
// Actions supported (via POST JSON body { act: "..." } unless noted):
// - GET  ?act=me                     -> proxies Graph /me using your bearer/cookie
// - POST {act:"create", notebookName, sectionName, title, html}
// - POST {act:"batch",  notebookName, sectionNames: []}             (idempotent)
// - POST {act:"cleanup", notebookName?, sectionNames?, titlePrefix?} (soft-delete testy notes)
//   Defaults for cleanup: looks for titles starting with [DIAG], [TEST], [WORKOUT] quick log, etc.
//
// Bearer is taken from:
//   1) req.headers.authorization ("Authorization: Bearer …"), OR
//   2) req.cookies.access_token (we synthesize "Bearer …")
//
// All responses are normalized: { ok: true/false, ... , version: "onenote-v2" }

export default async function handler(req, res) {
  try {
    const act = (req.method === "GET" ? (req.query.act || "") : (req.body?.act || "")).toString().toLowerCase();

    // Routing
    if (req.method === "GET" && act === "me") {
      const bearer = getBearerFromReq(req);
      if (!bearer) return json(res, 401, { ok: false, error: "No access token", version: V });
      const j = await graphGET("/me", bearer);
      return json(res, 200, j.ok ? { ok: true, me: j.json, version: V } : { ok: false, error: j.error, version: V });
    }

    if (req.method !== "POST") {
      return json(res, 405, { ok: false, error: "Use GET ?act=me or POST with {act}", version: V });
    }

    const bearer = getBearerFromReq(req);
    if (!bearer) return json(res, 401, { ok: false, error: "No access token (header or cookie)", version: V });

    switch (act) {
      case "create": {
        const {
          notebookName = "AliceChatGPT",
          sectionName,
          title = "[DIAG] Untitled",
          html = "<p>Hello from unified endpoint</p>",
        } = req.body || {};
        if (!notebookName || !sectionName) return json(res, 400, { ok: false, error: "notebookName and sectionName required", version: V });

        const nb = await findNotebookByName(bearer, notebookName);
        if (!nb) return json(res, 404, { ok: false, error: `Notebook not found: ${notebookName}`, version: V });

        const sec = await findSectionByName(bearer, nb.id, sectionName);
        if (!sec) return json(res, 404, { ok: false, error: `Section not found: ${sectionName}`, version: V });

        const created = await createPage(bearer, sec.id, title, html);
        if (!created.ok) return json(res, 200, { ok: false, error: created.error, version: V });
        return json(res, 200, { ok: true, created: created.json, version: V });
      }

      case "batch": {
        const { notebookName = "AliceChatGPT", sectionNames } = req.body || {};
        if (!notebookName || !Array.isArray(sectionNames) || sectionNames.length === 0) {
          return json(res, 400, { ok: false, error: "notebookName and non-empty sectionNames[] required", version: V });
        }

        const nb = await findNotebookByName(bearer, notebookName);
        if (!nb) return json(res, 404, { ok: false, error: `Notebook not found: ${notebookName}`, version: V });

        const current = await listSections(bearer, nb.id);
        if (!current.ok) return json(res, 200, { ok: false, error: current.error, version: V });

        const have = new Set((current.json.value || []).map(s => (s.displayName || "").trim().toLowerCase()));
        const toCreate = sectionNames.filter(n => !have.has(n.trim().toLowerCase()));

        const created = [];
        const skipped = [];
        for (const name of sectionNames) {
          if (toCreate.includes(name)) {
            const r = await graphPOST(`/me/onenote/notebooks/${enc(nb.id)}/sections`, bearer, {
              displayName: name
            }, "application/json");
            if (r.ok) created.push({ name, id: r.json?.id });
            else skipped.push({ name, error: r.error || "create failed" });
          } else {
            skipped.push({ name, reason: "exists" });
          }
        }

        return json(res, 200, { ok: true, notebookId: nb.id, created, skipped, version: V });
      }

      case "cleanup": {
        const {
          notebookName = "AliceChatGPT",
          sectionNames,                     // optional; if omitted, all sections in notebook
          titlePrefix = "[DIAG],[TEST],[WORKOUT] quick log,[HOBBY] RC cars — parts list"
        } = req.body || {};

        const nb = await findNotebookByName(bearer, notebookName);
        if (!nb) return json(res, 404, { ok: false, error: `Notebook not found: ${notebookName}`, version: V });

        // Sections to sweep
        const allSecs = await listSections(bearer, nb.id);
        if (!allSecs.ok) return json(res, 200, { ok: false, error: allSecs.error, version: V });

        const wanted = sectionNames && sectionNames.length
          ? (allSecs.json.value || []).filter(s => sectionNames.map(x => x.trim().toLowerCase()).includes((s.displayName || "").trim().toLowerCase()))
          : (allSecs.json.value || []);

        const prefixes = titlePrefix.split(",").map(s => s.trim()).filter(Boolean);
        const deleted = [];
        const errors = [];

        // For each section, list pages and soft-delete those with matching prefixes
        for (const sec of wanted) {
          const pages = await graphGET(`/me/onenote/sections/${enc(sec.id)}/pages?$select=id,title,links`, bearer);
          if (!pages.ok) { errors.push({ section: sec.displayName, error: pages.error }); continue; }

          for (const p of (pages.json.value || [])) {
            const t = (p.title || "");
            if (prefixes.some(pref => t.startsWith(pref))) {
              const del = await graphDELETE(`/me/onenote/pages/${enc(p.id)}`, bearer);
              if (del.ok) deleted.push({ id: p.id, title: t, section: sec.displayName });
              else errors.push({ id: p.id, title: t, error: del.error });
            }
          }
        }

        return json(res, 200, { ok: true, deleted, errors, version: V });
      }

      default:
        return json(res, 400, { ok: false, error: `Unknown act: ${act}`, version: V });
    }
  } catch (e) {
    return json(res, 200, { ok: false, error: String(e && e.message || e), version: V });
  }
}

/* ----------------------- helpers ----------------------- */
const V = "onenote-v2";

function json(res, code, obj) {
  res.status(code).json(obj);
}

function getBearerFromReq(req) {
  const h = req.headers?.authorization || "";
  if (h) return h.startsWith("Bearer ") ? h : `Bearer ${h.replace(/^Authorization:\s*/i, "")}`;
  const cookieTok = req.cookies?.access_token;
  return cookieTok ? `Bearer ${cookieTok}` : "";
}

async function graphGET(path, bearer) {
  try {
    const r = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
      headers: { Authorization: bearer },
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: `graph GET ${path} -> ${r.status}: ${stringify(j)}` };
    return { ok: true, json: j };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}

async function graphPOST(path, bearer, body, contentType = "application/json") {
  try {
    const r = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
      method: "POST",
      headers: { Authorization: bearer, "Content-Type": contentType },
      body: contentType === "application/json" ? JSON.stringify(body) : body,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: `graph POST ${path} -> ${r.status}: ${stringify(j)}` };
    return { ok: true, json: j };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}

async function graphDELETE(path, bearer) {
  try {
    const r = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
      method: "DELETE",
      headers: { Authorization: bearer },
    });
    if (r.status === 204) return { ok: true };
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: `graph DELETE ${path} -> ${r.status}: ${stringify(j)}` };
    return { ok: true, json: j };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}

async function findNotebookByName(bearer, notebookName) {
  const r = await graphGET(`/me/onenote/notebooks?$select=id,displayName`, bearer);
  if (!r.ok) return null;
  const want = (notebookName || "").trim().toLowerCase();
  return (r.json.value || []).find(n => (n.displayName || "").trim().toLowerCase() === want) || null;
}

async function listSections(bearer, notebookId) {
  return await graphGET(`/me/onenote/notebooks/${enc(notebookId)}/sections?$select=id,displayName`, bearer);
}

async function findSectionByName(bearer, notebookId, sectionName) {
  const r = await listSections(bearer, notebookId);
  if (!r.ok) return null;
  const want = (sectionName || "").trim().toLowerCase();
  return (r.json.value || []).find(s => (s.displayName || "").trim().toLowerCase() === want) || null;
}

async function createPage(bearer, sectionId, title, html) {
  const boundary = "----AliceUnifiedBoundary" + Math.random().toString(36).slice(2);
  const htmlDoc = `<!DOCTYPE html><html><head><title>${escapeHtml(title)}</title></head><body>${html}</body></html>`;
  const body =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="Presentation"\r\n` +
    `Content-Type: text/html\r\n\r\n` +
    htmlDoc + `\r\n` +
    `--${boundary}--\r\n`;

  return await graphPOST(`/me/onenote/sections/${enc(sectionId)}/pages`, bearer, body, `multipart/form-data; boundary=${boundary}`);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
function enc(s) { return encodeURIComponent(s); }
function stringify(x) { try { return JSON.stringify(x); } catch { return String(x); } }
