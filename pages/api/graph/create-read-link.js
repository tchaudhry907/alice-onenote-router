// pages/api/graph/create-read-link.js
import { getBearerFromReq, graphGET, graphPOST } from "@/lib/auth";

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
    'Content-Disposition:form-data; name="Presentation"',
    "Content-Type:text/html",
    "",
    `<!DOCTYPE html><html><head><title>${escapeHtml(title || "")}</title></head><body>${html || "<p></p>"}</body></html>`,
    `--${boundary}--`,
    ""
  ];
  return { body: parts.join("\r\n"), boundary };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const token = getBearerFromReq(req);
    if (!token) {
      return res.status(401).json({ ok: false, error: "Missing access token (send Authorization: Bearer …)" });
    }

    const {
      title = "",
      html = "<p></p>",
      sectionId,      // Graph section id (preferred if provided)
      notebookName,   // resolve by names if given
      sectionName     // resolve by names if given
    } = req.body || {};

    let resolvedSectionId = sectionId;

    // Resolve by notebook + section names if needed
    if (!resolvedSectionId && (notebookName || sectionName)) {
      const nbRes = await graphGET(token, `/me/onenote/notebooks?$select=id,displayName`);
      const notebooks = nbRes.value || nbRes.notebooks || [];
      const nb = notebooks.find(
        (n) => (n.displayName || n.name || "").toLowerCase() === String(notebookName || "").toLowerCase()
      );
      if (!nb) {
        return res.status(404).json({ ok: false, error: `Notebook not found: ${notebookName}` });
      }

      const secRes = await graphGET(token, `/me/onenote/notebooks/${nb.id}/sections?$select=id,displayName`);
      const secs = secRes.value || secRes.sections || [];
      const sec = secs.find(
        (s) => (s.displayName || s.name || "").toLowerCase() === String(sectionName || "").toLowerCase()
      );
      if (!sec) {
        return res.status(404).json({ ok: false, error: `Section not found: ${sectionName}` });
      }
      resolvedSectionId = sec.id;
    }

    // Fallback to env default (kept for back-compat)
    if (!resolvedSectionId) {
      const fallbackId = process.env.DEFAULT_SECTION_ID || process.env.DEFAULT_ONENOTE_SECTION_ID;
      if (!fallbackId) {
        return res.status(400).json({
          ok: false,
          error: "No section specified and DEFAULT_SECTION_ID not configured"
        });
      }
      resolvedSectionId = fallbackId;
    }

    // Create page
    const { body, boundary } = buildMultipartForHtml(title, html);
    const created = await graphPOST(
      token,
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
        oneNoteWebUrl: links.oneNoteWebUrl || null
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = err?.status || 500;
    return res.status(code).json({ ok: false, error: msg });
  }
}
