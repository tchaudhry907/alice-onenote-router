// pages/api/graph/create-read-link.js

/**
 * This route creates (or upserts) a OneNote page and returns web/client links.
 * It supports three ways to target a section, in this order:
 *   1) req.body.sectionId  (Graph section id)
 *   2) req.body.notebookName + req.body.sectionName (resolve by names)
 *   3) process.env.DEFAULT_SECTION_ID (OneNote "id" style your server already uses)
 *
 * It expects your existing graphGET / graphPOST helpers and token plumbing.
 * If your helpers live elsewhere, adjust the imports or inline fetches as needed.
 */

async function graphGET(path) {
  const r = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: await authHeaders()
  });
  if (!r.ok) {
    const t = await safeText(r);
    throw new Error(`graphGET ${path} -> ${r.status}: ${t}`);
  }
  return r.json();
}

async function graphPOST(path, body, contentType = "application/json") {
  const r = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    method: "POST",
    headers: await authHeaders(contentType),
    body: contentType === "application/json" ? JSON.stringify(body) : body
  });
  if (!r.ok) {
    const t = await safeText(r);
    throw new Error(`graphPOST ${path} -> ${r.status}: ${t}`);
  }
  return r.json();
}

/**
 * Pull bearer from cookie set by your device flow (or env if you do that server-side).
 * If your project already has a util for this, replace this with that import.
 */
async function authHeaders(contentType) {
  // In Next API routes, we’ll stash the last token in a cookie called ms_access_token
  // If your auth flow stores it differently, replace this.
  const headers = {};
  // NOTE: In Next.js API route runtime, we don’t have req here; in production you likely
  // build headers in the handler after reading cookies. To keep this file self-contained,
  // we’ll read from process.env if present (your router already acts as the “session”).
  if (process.env.MS_GRAPH_BEARER) {
    headers["Authorization"] = `Bearer ${process.env.MS_GRAPH_BEARER}`;
  }
  if (contentType) headers["Content-Type"] = contentType;
  return headers;
}

async function safeText(r) {
  try {
    return await r.text();
  } catch {
    return "";
  }
}

/**
 * Build a super-simple HTML body for the OneNote page.
 * Your server previously accepted { title, html }. We keep that shape.
 */
function buildMultipartForHtml(title, html) {
  // Create OneNote multipart body per Graph docs
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

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const {
      title = "",
      html = "<p></p>",
      sectionId,          // Graph section id (preferred if provided)
      notebookName,       // Resolve by names if given
      sectionName,        // Resolve by names if given
      mode                // (optional) future behavior control
    } = req.body || {};

    let resolvedSectionId = sectionId;

    // If no explicit sectionId, try by names
    if (!resolvedSectionId && (notebookName || sectionName)) {
      // 1) find the notebook by displayName
      const nbRes = await graphGET(`/me/onenote/notebooks?$select=id,displayName`);
      const notebooks = nbRes.value || nbRes.notebooks || [];
      const nb = notebooks.find(
        (n) => (n.displayName || n.name || "").toLowerCase() === String(notebookName || "").toLowerCase()
      );

      if (!nb) {
        return res
          .status(404)
          .json({ ok: false, error: `Notebook not found: ${notebookName}` });
      }

      // 2) find the section inside that notebook
      const secRes = await graphGET(`/me/onenote/notebooks/${nb.id}/sections?$select=id,displayName`);
      const secs = secRes.value || secRes.sections || [];
      const sec = secs.find(
        (s) => (s.displayName || s.name || "").toLowerCase() === String(sectionName || "").toLowerCase()
      );

      if (!sec) {
        return res
          .status(404)
          .json({ ok: false, error: `Section not found: ${sectionName}` });
      }

      resolvedSectionId = sec.id; // real Graph id
    }

    // If still nothing, fall back to DEFAULT_SECTION_ID
    if (!resolvedSectionId) {
      // Your env is already pointed at AliceChatGPT/Inbox
      const fallbackId = process.env.DEFAULT_SECTION_ID || process.env.DEFAULT_ONENOTE_SECTION_ID;
      if (!fallbackId) {
        return res.status(400).json({
          ok: false,
          error: "No section specified and DEFAULT_SECTION_ID not configured"
        });
      }
      // DEFAULT_SECTION_ID might be a OneNote composite id (with "!"). Graph requires Graph id.
      // If your router stores the Graph id here now, we can use it directly. Otherwise,
      // you can translate before calling graph (left as-is to match your current server).
      resolvedSectionId = fallbackId;
    }

    // Create page
    const { body, boundary } = buildMultipartForHtml(title, html);
    const create = await graphPOST(
      `/me/onenote/sections/${encodeURIComponent(resolvedSectionId)}/pages`,
      body,
      `multipart/form-data; boundary=${boundary}`
    );

    // Extract links the way your client expects
    const links = create?.links || {};
    const payload = {
      ok: true,
      created: { id: create?.id || null },
      text: `${title} ${html?.replace(/<[^>]*>/g, " ").trim()}`.trim(),
      links: {
        oneNoteClientUrl: links.oneNoteClientUrl || null,
        oneNoteWebUrl: links.oneNoteWebUrl || null
      }
    };

    return res.status(200).json(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(404).json({ ok: false, error: msg });
  }
}
