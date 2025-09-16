// pages/api/graph/create-read-link.js
//
// Creates a OneNote page and returns links.
// Accepts either:
//   - { sectionId, title, html }
//   - { notebookName, sectionName, title, html }
// Falls back to DEFAULT_SECTION_ID if neither is provided.
// Uses Authorization bearer from the incoming request when present.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const authz = req.headers["authorization"] || "";
    const bearer = extractBearer(authz) || process.env.MS_GRAPH_BEARER || "";
    if (!bearer) {
      return res
        .status(401)
        .json({ ok: false, error: "Missing Authorization bearer token" });
    }

    const {
      title = "",
      html = "<p></p>",
      sectionId,     // Graph/OneNote id (we pass through)
      notebookName,  // resolve by name if provided
      sectionName,   // resolve by name if provided
    } = req.body || {};

    let resolvedSectionId = sectionId;

    // Resolve by names if needed
    if (!resolvedSectionId && (notebookName || sectionName)) {
      const nbRes = await graphGET(
        "/me/onenote/notebooks?$select=id,displayName",
        bearer
      );
      const notebooks = nbRes.value || nbRes.notebooks || [];
      const nb = notebooks.find(
        (n) =>
          (n.displayName || n.name || "").toLowerCase() ===
          String(notebookName || "").toLowerCase()
      );
      if (!nb) {
        return res
          .status(404)
          .json({ ok: false, error: `Notebook not found: ${notebookName}` });
      }

      const secRes = await graphGET(
        `/me/onenote/notebooks/${nb.id}/sections?$select=id,displayName`,
        bearer
      );
      const secs = secRes.value || secRes.sections || [];
      const sec = secs.find(
        (s) =>
          (s.displayName || s.name || "").toLowerCase() ===
          String(sectionName || "").toLowerCase()
      );
      if (!sec) {
        return res
          .status(404)
          .json({ ok: false, error: `Section not found: ${sectionName}` });
      }
      resolvedSectionId = sec.id;
    }

    if (!resolvedSectionId) {
      const fallback =
        process.env.DEFAULT_SECTION_ID || process.env.DEFAULT_ONENOTE_SECTION_ID;
      if (!fallback) {
        return res.status(400).json({
          ok: false,
          error:
            "No section specified and DEFAULT_SECTION_ID not configured on the server",
        });
      }
      resolvedSectionId = fallback;
    }

    // Build a strict-compliant multipart body
    const { body, boundary } = buildMultipartForHtml(title, html);

    const create = await graphPOST(
      `/me/onenote/sections/${encodeURIComponent(resolvedSectionId)}/pages`,
      body,
      `multipart/form-data; boundary=${boundary}`,
      bearer
    );

    const links = create?.links || {};
    return res.status(200).json({
      ok: true,
      created: { id: create?.id || null },
      links: {
        oneNoteClientUrl: links.oneNoteClientUrl || null,
        oneNoteWebUrl: links.oneNoteWebUrl || null,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(400).json({ ok: false, error: msg });
  }
}

// ---------- helpers ----------

function extractBearer(h) {
  if (!h) return "";
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1] : "";
}

async function graphGET(path, bearer) {
  const r = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: {
      Authorization: `Bearer ${bearer}`,
    },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`graphGET ${path} -> ${r.status}: ${text}`);
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function graphPOST(path, body, contentType, bearer) {
  const r = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearer}`,
      "Content-Type": contentType,
    },
    body,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`graphPOST ${path} -> ${r.status}: ${text}`);
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

// Build a OneNote-compliant multipart body with strict CRLFs and header spacing.
function buildMultipartForHtml(title, html) {
  const boundary = "oneNoteBoundary" + Math.random().toString(16).slice(2);
  const CRLF = "\r\n";

  const doc =
    "<!DOCTYPE html><html><head><title>" +
    escapeHtml(title || "") +
    "</title></head><body>" +
    (html || "<p></p>") +
    "</body></html>";

  const parts =
    `--${boundary}${CRLF}` +
    // NOTE the space after ":" in both headers — Graph can be picky here.
    `Content-Disposition: form-data; name="Presentation"${CRLF}` +
    `Content-Type: text/html${CRLF}${CRLF}` +
    doc +
    `${CRLF}--${boundary}--${CRLF}`;

  return { body: parts, boundary };
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
