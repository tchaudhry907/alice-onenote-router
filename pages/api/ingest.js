// pages/api/ingest.js
// Ingests freeform text into OneNote (defaults: AliceChatGPT -> Inbox).

const GRAPH = "https://graph.microsoft.com/v1.0";

function send(res, code, data) {
  res.status(code).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data, null, 2));
}

function getAccessTokenFromCookie(req) {
  // You already set these in your flow; reuse the same cookie we use elsewhere.
  const hdr = req.headers.cookie || "";
  // crude parse
  const map = Object.fromEntries(
    hdr.split(";").map(s => s.trim()).filter(Boolean).map(pair => {
      const i = pair.indexOf("=");
      return i === -1 ? [pair, ""] : [pair.slice(0, i), decodeURIComponent(pair.slice(i + 1))];
    })
  );
  return map["access_token"] || null;
}

async function gfetch(token, path, init = {}) {
  const res = await fetch(`${GRAPH}${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json",
      ...(init.headers || {})
    }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Graph ${res.status} on ${path}: ${text}`);
  }
  return res.json();
}

async function findNotebookId(token, name = "AliceChatGPT") {
  const data = await gfetch(token, `/me/onenote/notebooks?$select=id,displayName&$top=200`);
  const hit = (data.value || []).find(n => (n.displayName || "").toLowerCase() === name.toLowerCase());
  return hit ? hit.id : null;
}

async function findSectionIdInNotebook(token, notebookId, sectionName = "Inbox") {
  const data = await gfetch(token, `/me/onenote/notebooks/${encodeURIComponent(notebookId)}/sections?$select=id,displayName&$top=200`);
  const hit = (data.value || []).find(s => (s.displayName || "").toLowerCase() === sectionName.toLowerCase());
  return hit ? hit.id : null;
}

function buildMultipartHTML({ title, body }) {
  // Minimal valid OneNote HTML presentation
  return `<!DOCTYPE html>
<html>
  <head>
    <title>${escapeHtml(title || "Untitled")}</title>
    <meta name="created" content="${new Date().toISOString()}" />
  </head>
  <body>
    <h1>${escapeHtml(title || "")}</h1>
    <p>${escapeHtml(body || "")}</p>
  </body>
</html>`;
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildMultipartBody(html) {
  const boundary = `--------------------------${Math.random().toString(16).slice(2)}`;
  const parts = [];
  parts.push(`--${boundary}\r\n` +
             `Content-Disposition: form-data; name="Presentation"\r\n` +
             `Content-Type: text/html\r\n\r\n` +
             `${html}\r\n`);
  parts.push(`--${boundary}--\r\n`);
  const blob = new Blob(parts, { type: `multipart/form-data; boundary=${boundary}` });
  return { body: blob, boundary };
}

export default async function handler(req, res) {
  try {
    // Accept POST (JSON) or GET (query) for quick testing.
    const method = req.method || "GET";
    const params = method === "POST" ? (req.body || {}) : (req.query || {});

    let {
      title,            // optional; defaults to "Daily Log YYYY-MM-DD"
      body,             // required
      sectionName,      // defaults to "Inbox"
      notebookName,     // defaults to "AliceChatGPT"
      notebookId,       // optional override
      sectionId         // optional override
    } = params;

    const token = getAccessTokenFromCookie(req);
    if (!token) return send(res, 401, { error: "No access_token cookie" });

    if (!body || String(body).trim().length === 0) {
      return send(res, 400, { error: "Missing 'body' text" });
    }

    const today = new Date().toISOString().slice(0, 10);
    title = title && String(title).trim().length ? String(title) : `Daily Log ${today}`;
    notebookName = notebookName || "AliceChatGPT";
    sectionName = sectionName || "Inbox";

    // Resolve notebook/section if not provided
    if (!notebookId) {
      notebookId = await findNotebookId(token, notebookName);
      if (!notebookId) return send(res, 404, { error: `Notebook '${notebookName}' not found` });
    }
    if (!sectionId) {
      sectionId = await findSectionIdInNotebook(token, notebookId, sectionName);
      if (!sectionId) return send(res, 404, { error: `Section '${sectionName}' not found in notebook '${notebookName}'` });
    }

    // Build content
    const html = buildMultipartHTML({ title, body });
    const { body: mpBody, boundary } = buildMultipartBody(html);

    // Create the page under the section
    const postUrl = `/me/onenote/sections/${encodeURIComponent(sectionId)}/pages`;
    const created = await fetch(`${GRAPH}${postUrl}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
        "Content-Type": `multipart/form-data; boundary=${boundary}`
      },
      body: mpBody
    });

    if (!created.ok) {
      const errTxt = await created.text().catch(() => "");
      return send(res, created.status, { error: "Create failed", details: errTxt });
    }

    const raw = await created.json();
    const link = raw?.links?.oneNoteClientUrl?.href || raw?.links?.oneNoteWebUrl?.href || null;

    return send(res, 200, {
      created: {
        id: raw.id,
        title: raw.title,
        section: sectionName,
        notebook: notebookName,
        createdDateTime: raw.createdDateTime,
        link
      },
      raw
    });
  } catch (err) {
    return send(res, 500, { error: String(err && err.message || err) });
  }
}
