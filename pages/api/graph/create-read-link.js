// pages/api/graph/create-read-link.js

/**
 * Create a OneNote page and return client/web links.
 * Targets a section by either:
 *  - req.body.sectionId (Graph section id), OR
 *  - req.body.notebookName + req.body.sectionName (resolve by names)
 *
 * Auth:
 *  - Reads "Authorization: Bearer <token>" header, OR
 *  - Cookie "access_token=<token>"
 */

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(401).json({ ok: false, error: "No access token" });
  }

  try {
    const bearer = getBearer(req);
    if (!bearer) {
      return res.status(401).json({ ok: false, error: "No access token" });
    }

    const {
      title = "",
      html = "<p></p>",
      sectionId,
      notebookName,
      sectionName,
    } = req.body || {};

    // resolve a sectionId if only names were provided
    let resolvedSectionId = sectionId;
    if (!resolvedSectionId && (notebookName || sectionName)) {
      if (!notebookName || !sectionName) {
        return res.status(400).json({
          ok: false,
          error: "When using names, provide both notebookName and sectionName",
        });
      }

      const nbRes = await graphGET(
        bearer,
        `/me/onenote/notebooks?$select=id,displayName`
      );
      const notebooks = nbRes?.value || [];
      const nb = notebooks.find(
        (n) =>
          (n.displayName || "").toLowerCase() ===
          String(notebookName).toLowerCase()
      );
      if (!nb) {
        return res
          .status(404)
          .json({ ok: false, error: `Notebook not found: ${notebookName}` });
      }

      const secRes = await graphGET(
        bearer,
        `/me/onenote/notebooks/${encodeURIComponent(
          nb.id
        )}/sections?$select=id,displayName`
      );
      const sections = secRes?.value || [];
      const sec = sections.find(
        (s) =>
          (s.displayName || "").toLowerCase() ===
          String(sectionName).toLowerCase()
      );
      if (!sec) {
        return res
          .status(404)
          .json({ ok: false, error: `Section not found: ${sectionName}` });
      }

      resolvedSectionId = sec.id;
    }

    if (!resolvedSectionId) {
      return res.status(400).json({
        ok: false,
        error:
          "No section specified (sectionId or notebookName+sectionName required).",
      });
    }

    // Build the OneNote multipart body
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
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: toErr(err) });
  }
}

/* -------------------------- helpers -------------------------- */

function getBearer(req) {
  // Priority 1: Authorization header
  const auth = req.headers?.authorization || req.headers?.Authorization;
  if (auth && /^Bearer\s+/i.test(auth)) {
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    if (token) return `Bearer ${token}`;
  }
  // Priority 2: access_token cookie
  const cookie = req.headers?.cookie || "";
  const token = getCookieValue(cookie, "access_token");
  if (token) return `Bearer ${token}`;
  return null;
}

function getCookieValue(cookieHeader, name) {
  if (!cookieHeader) return null;
  // simple cookie parse
  const parts = cookieHeader.split(";").map((s) => s.trim());
  for (const p of parts) {
    const i = p.indexOf("=");
    if (i > 0) {
      const k = p.slice(0, i).trim();
      if (k === name) {
        return decodeURIComponent(p.slice(i + 1).trim());
      }
    }
  }
  return null;
}

async function graphGET(bearer, path) {
  const r = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    method: "GET",
    headers: {
      Authorization: bearer,
    },
  });
  if (!r.ok) {
    throw new Error(
      `graph GET ${path} -> ${r.status}: ${await safeText(r)}`
    );
  }
  return r.json();
}

async function graphPOST(bearer, path, body, contentType) {
  const r = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    method: "POST",
    headers: {
      Authorization: bearer,
      "Content-Type": contentType || "application/json",
    },
    body,
  });
  if (!r.ok) {
    throw new Error(
      `graph POST ${path} -> ${r.status}: ${await safeText(r)}`
    );
  }
  // OneNote page-create returns JSON
  return r.json();
}

async function safeText(r) {
  try {
    return await r.text();
  } catch {
    return "";
  }
}

function buildOneNoteMultipart(title, html) {
  // Use a boundary that won't appear in the payload
  const boundary = "oneNoteBoundary_" + Math.random().toString(36).slice(2);
  // Per Graph docs, the 'Presentation' part contains full HTML
  const lines = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="Presentation"`,
    `Content-Type: text/html`,
    ``,
    `<!DOCTYPE html><html><head><title>${escapeHtml(
      title || ""
    )}</title></head><body>${html || "<p></p>"}</body></html>`,
    `--${boundary}--`,
    ``,
  ];
  // Use CRLFs in multipart
  const body = lines.join("\r\n");
  return { body, boundary };
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function toErr(e) {
  if (!e) return "Unknown error";
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
