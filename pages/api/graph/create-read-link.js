// pages/api/graph/create-read-link.js
//
// Creates a OneNote page and returns web/client links.
// Section selection priority:
//   1) req.body.sectionId
//   2) req.body.notebookName + req.body.sectionName
//   3) process.env.DEFAULT_SECTION_ID (fallback)
//
// Uses graphFetch() which auto-refreshes tokens.

import { graphFetch } from "@/lib/auth";

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildMultipartForHtml(title, html) {
  const boundary = "oneNoteBoundary";
  const parts = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="Presentation"',
    "Content-Type: text/html",
    "",
    `<!DOCTYPE html><html><head><title>${escapeHtml(title || "")}</title></head><body>${html || "<p></p>"}</body></html>`,
    `--${boundary}--`,
    "",
  ];
  return { body: parts.join("\r\n"), boundary };
}

async function graphGET(req, path) {
  const r = await graphFetch(req, path, { method: "GET" });
  const text = await r.text();
  if (!r.ok) throw new Error(`graphGET ${path} -> ${r.status}: ${text}`);
  return JSON.parse(text);
}

async function graphPOST(req, path, body, contentType = "application/json") {
  const init = {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: contentType === "application/json" ? JSON.stringify(body) : body,
  };
  const r = await graphFetch(req, path, init);
  const text = await r.text();
  if (!r.ok) throw new Error(`graphPOST ${path} -> ${r.status}: ${text}`);
  return JSON.parse(text || "{}");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const {
      title = "",
      html = "<p></p>",
      sectionId,
      notebookName,
      sectionName,
    } = req.body || {};

    let resolvedSectionId = sectionId;

    // Resolve by names if needed
    if (!resolvedSectionId && (notebookName || sectionName)) {
      const nbRes = await graphGET(req, `/me/onenote/notebooks?$select=id,displayName`);
      const notebooks = nbRes.value || nbRes.notebooks || [];
      const nb = notebooks.find(
        (n) => (n.displayName || n.name || "").toLowerCase() === String(notebookName || "").toLowerCase()
      );
      if (!nb) return res.status(404).json({ ok: false, error: `Notebook not found: ${notebookName}` });

      const secRes = await graphGET(req, `/me/onenote/notebooks/${nb.id}/sections?$select=id,displayName`);
      const secs = secRes.value || secRes.sections || [];
      const sec = secs.find(
        (s) => (s.displayName || s.name || "").toLowerCase() === String(sectionName || "").toLowerCase()
      );
      if (!sec) return res.status(404).json({ ok: false, error: `Section not found: ${sectionName}` });

      resolvedSectionId = sec.id;
    }

    // Fallback
    if (!resolvedSectionId) {
      const fallbackId = process.env.DEFAULT_SECTION_ID;
      if (!fallbackId) {
        return res.status(400).json({
          ok: false,
          error: "No section specified and DEFAULT_SECTION_ID not configured",
        });
      }
      resolvedSectionId = fallbackId;
    }

    // Create page (multipart)
    const { body, boundary } = buildMultipartForHtml(title, html);
    const created = await graphPOST(
      req,
      `/me/onenote/sections/${encodeURIComponent(resolvedSectionId)}/pages`,
      body,
      `multipart/form-data; boundary=${boundary}`
    );

    const links = created?.links || {};
    const payload = {
      ok: true,
      created: { id: created?.id || null },
      links: {
        oneNoteClientUrl: links.oneNoteClientUrl || null,
        oneNoteWebUrl: links.oneNoteWebUrl || null,
      },
    };
    return res.status(200).json(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(400).json({ ok: false, error: msg });
  }
}
