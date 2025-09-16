// pages/api/graph/create-read-link.js
//
// Self-contained API route that:
//  • pulls a Microsoft Graph access token from Authorization: Bearer ... (preferred)
//    or from an access_token cookie (fallback),
//  • resolves the target section (by sectionId OR by notebookName+sectionName OR DEFAULT_SECTION_ID),
//  • creates a OneNote page via Graph multipart upload,
//  • returns { ok, created: { id }, links: { oneNoteClientUrl, oneNoteWebUrl } }.
//
// Body shape (any one of the section selectors):
//   {
//     "title": "My title",
//     "html": "<p>Body HTML</p>",
//     "sectionId": "<graph section id>"
//   }
//   OR
//   {
//     "title": "My title",
//     "html": "<p>Body HTML</p>",
//     "notebookName": "AliceChatGPT",
//     "sectionName": "Fitness - Workouts"
//   }
//
// Fallback:
//   If no selector provided, uses process.env.DEFAULT_SECTION_ID (typically Inbox).

const GRAPH = "https://graph.microsoft.com/v1.0";

/* ----------------- tiny utils ----------------- */

function parseCookie(headerVal = "") {
  const out = {};
  headerVal.split(";").forEach((kv) => {
    const i = kv.indexOf("=");
    if (i > -1) out[kv.slice(0, i).trim()] = decodeURIComponent(kv.slice(i + 1).trim());
  });
  return out;
}

function getBearerFromReq(req) {
  const auth = req.headers?.authorization || req.headers?.Authorization;
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    const tok = auth.slice(7).trim();
    if (tok) return tok;
  }
  const cookieHeader = req.headers?.cookie || "";
  const cookies = parseCookie(cookieHeader);
  if (cookies.access_token) return cookies.access_token;
  return null;
}

async function safeText(res) {
  try { return await res.text(); } catch { return ""; }
}

async function graphFetch(req, method, path, body, contentType) {
  const token = getBearerFromReq(req);
  if (!token) {
    const err = new Error("No access token: send Authorization: Bearer <token> or set access_token cookie.");
    err.status = 401;
    throw err;
  }
  const headers = { Authorization: `Bearer ${token}` };
  if (contentType) headers["Content-Type"] = contentType;

  const url = path.startsWith("http") ? path : `${GRAPH}${path}`;
  const res = await fetch(url, {
    method,
    headers,
    body: typeof body === "string" ? body : (body ? JSON.stringify(body) : undefined),
  });

  if (!res.ok) {
    const txt = await safeText(res);
    const err = new Error(`graph ${method} ${path} -> ${res.status}: ${txt}`);
    err.status = res.status;
    err.payload = txt;
    throw err;
  }

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("json")) return {};
  return res.json();
}

function buildMultipartHtml(title, html) {
  const boundary = "oneNoteBoundary_" + Math.random().toString(36).slice(2);
  const parts = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="Presentation"',
    "Content-Type: text/html",
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

/* ----------------- main handler ----------------- */

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const {
      title = "",
      html = "<p></p>",
      sectionId,          // Graph section id
      notebookName,       // resolve by names if provided
      sectionName
    } = req.body || {};

    let resolvedSectionId = sectionId;

    // Resolve by names
    if (!resolvedSectionId && (notebookName || sectionName)) {
      if (!notebookName || !sectionName) {
        return res.status(400).json({ ok: false, error: "Provide both notebookName and sectionName, or a sectionId." });
      }

      // Find notebook
      const nbRes = await graphFetch(req, "GET", `/me/onenote/notebooks?$select=id,displayName`);
      const notebooks = nbRes.value || nbRes.notebooks || [];
      const nb = notebooks.find(
        (n) => (n.displayName || n.name || "").toLowerCase() === notebookName.toLowerCase()
      );
      if (!nb) {
        return res.status(404).json({ ok: false, error: `Notebook not found: ${notebookName}` });
      }

      // Find section inside notebook
      const secRes = await graphFetch(req, "GET", `/me/onenote/notebooks/${encodeURIComponent(nb.id)}/sections?$select=id,displayName`);
      const secs = secRes.value || secRes.sections || [];
      const sec = secs.find(
        (s) => (s.displayName || s.name || "").toLowerCase() === sectionName.toLowerCase()
      );
      if (!sec) {
        return res.status(404).json({ ok: false, error: `Section not found: ${sectionName}` });
      }

      resolvedSectionId = sec.id;
    }

    // Fallback to DEFAULT_SECTION_ID (your Inbox)
    if (!resolvedSectionId) {
      const fallback = process.env.DEFAULT_SECTION_ID || process.env.DEFAULT_ONENOTE_SECTION_ID;
      if (!fallback) {
        return res.status(400).json({
          ok: false,
          error: "No section specified and DEFAULT_SECTION_ID is not configured"
        });
      }
      resolvedSectionId = fallback;
    }

    // Create the page
    const { body, boundary } = buildMultipartHtml(title, html);
    const create = await graphFetch(
      req,
      "POST",
      `/me/onenote/sections/${encodeURIComponent(resolvedSectionId)}/pages`,
      body,
      `multipart/form-data; boundary=${boundary}`
    );

    const links = create?.links || {};
    const payload = {
      ok: true,
      created: { id: create?.id || null },
      links: {
        oneNoteClientUrl: links.oneNoteClientUrl || null,
        oneNoteWebUrl: links.oneNoteWebUrl || null
      }
    };
    return res.status(200).json(payload);
  } catch (err) {
    const status = err?.status || 500;
    return res.status(status).json({ ok: false, error: err?.message || String(err) });
  }
}
