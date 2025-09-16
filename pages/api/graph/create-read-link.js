// pages/api/graph/create-read-link.js
// Route version: r2-CRLF

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "POST only", version: "r2-CRLF" });
  }

  try {
    const bearer = getBearer(req);
    if (!bearer) return res.status(401).json({ ok: false, error: "No access token", version: "r2-CRLF" });

    const { title = "", html = "<p></p>", sectionId, notebookName, sectionName } = req.body || {};
    let resolvedSectionId = sectionId || null;
    let resolvedFrom = "body.sectionId";

    // If names provided, resolve to Graph section id
    if (!resolvedSectionId && (notebookName || sectionName)) {
      if (!notebookName || !sectionName) {
        return res.status(400).json({
          ok: false,
          error: "When using names, provide both notebookName and sectionName",
          version: "r2-CRLF",
        });
      }
      const nbRes = await graphGET(bearer, `/me/onenote/notebooks?$select=id,displayName`);
      const nb = (nbRes?.value || []).find(
        (n) => (n.displayName || "").toLowerCase() === String(notebookName).toLowerCase()
      );
      if (!nb) return res.status(404).json({ ok: false, error: `Notebook not found: ${notebookName}`, version: "r2-CRLF" });

      const secRes = await graphGET(bearer, `/me/onenote/notebooks/${encodeURIComponent(nb.id)}/sections?$select=id,displayName`);
      const sec = (secRes?.value || []).find(
        (s) => (s.displayName || "").toLowerCase() === String(sectionName).toLowerCase()
      );
      if (!sec) return res.status(404).json({ ok: false, error: `Section not found: ${sectionName}`, version: "r2-CRLF" });

      resolvedSectionId = sec.id;           // <-- Graph GUID style
      resolvedFrom = "lookup.names";
    }

    if (!resolvedSectionId) {
      return res.status(400).json({
        ok: false,
        error: "No section specified (sectionId or notebookName+sectionName required).",
        version: "r2-CRLF",
      });
    }

    // Build strict CRLF multipart body
    const { body, boundary } = buildOneNoteMultipart(title, html);

    // Create page
    const created = await graphPOST(
      bearer,
      `/me/onenote/sections/${encodeURIComponent(resolvedSectionId)}/pages`,
      body,
      `multipart/form-data; boundary=${boundary}`
    );

    const links = created?.links || {};
    return res.status(200).json({
      ok: true,
      created: { id: created?.id || null },
      links: {
        oneNoteClientUrl: links.oneNoteClientUrl || null,
        oneNoteWebUrl: links.oneNoteWebUrl || null,
      },
      debug: { version: "r2-CRLF", usedSectionId: resolvedSectionId, resolvedFrom },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: toErr(err), version: "r2-CRLF" });
  }
}

/* ---------------- helpers ---------------- */

function getBearer(req) {
  const h = req.headers || {};
  const auth = h.authorization || h.Authorization;
  if (auth && /^Bearer\s+/i.test(auth)) {
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    if (token) return `Bearer ${token}`;
  }
  // (Optional) fall back to cookie
  const ck = h.cookie || "";
  const token = getCookieValue(ck, "access_token");
  if (token) return `Bearer ${token}`;
  return null;
}
function getCookieValue(cookieHeader, name) {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const p = part.trim();
    const i = p.indexOf("=");
    if (i > 0 && p.slice(0, i) === name) return decodeURIComponent(p.slice(i + 1));
  }
  return null;
}

async function graphGET(bearer, path) {
  const r = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    method: "GET",
    headers: { Authorization: bearer },
  });
  if (!r.ok) throw new Error(`graph GET ${path} -> ${r.status}: ${await safeText(r)}`);
  return r.json();
}
async function graphPOST(bearer, path, body, contentType) {
  const r = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    method: "POST",
    headers: { Authorization: bearer, "Content-Type": contentType },
    body,
  });
  if (!r.ok) throw new Error(`graph POST ${path} -> ${r.status}: ${await safeText(r)}`);
  return r.json();
}
async function safeText(r) { try { return await r.text(); } catch { return ""; } }

function buildOneNoteMultipart(title, html) {
  const boundary = "oneNoteBoundary_" + Math.random().toString(36).slice(2);
  const lines = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="Presentation"`,
    `Content-Type: text/html`,
    ``,
    `<!DOCTYPE html><html><head><title>${escapeHtml(title || "")}</title></head><body>${html || "<p></p>"}</body></html>`,
    `--${boundary}--`,
    ``,
  ];
  // IMPORTANT: CRLF required for multipart
  const body = lines.join("\r\n");
  return { body, boundary };
}
function escapeHtml(s) {
  return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
function toErr(e) { if (!e) return "Unknown error"; if (e instanceof Error) return e.message; try { return JSON.stringify(e); } catch { return String(e); } }
