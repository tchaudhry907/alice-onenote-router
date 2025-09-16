// pages/api/graph/create-read-link.js
// Minimal, header-forwarding version that takes YOUR bearer token and calls Graph.
// Supports either (sectionId) OR (notebookName + sectionName).

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(401).json({ ok: false, error: "No access token" }); // keep behavior consistent with what you saw
  }

  try {
    // 1) Get Authorization header EXACTLY as sent by the client
    const auth = req.headers["authorization"] || req.headers["Authorization"];
    if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
      return res.status(401).json({ ok: false, error: "Missing Authorization: Bearer <token>" });
    }
    const authHeader = auth; // do NOT add “Bearer ” again

    // 2) Parse body
    const { title = "", html = "<p></p>", sectionId, notebookName, sectionName } = req.body || {};

    // 3) Helper to call Graph with your bearer
    const graphGET = async (path) => {
      const r = await fetch("https://graph.microsoft.com/v1.0" + path, {
        headers: { Authorization: authHeader }
      });
      const text = await r.text();
      if (!r.ok) throw new Error(`graph GET ${path} -> ${r.status}: ${text}`);
      return JSON.parse(text);
    };

    const graphPOST = async (path, body, contentType) => {
      const headers = { Authorization: authHeader };
      if (contentType) headers["Content-Type"] = contentType;
      const r = await fetch("https://graph.microsoft.com/v1.0" + path, {
        method: "POST",
        headers,
        body
      });
      const text = await r.text();
      if (!r.ok) throw new Error(`graph POST ${path} -> ${r.status}: ${text}`);
      return text ? JSON.parse(text) : {};
    };

    // 4) Resolve section id
    let resolvedSectionId = sectionId;
    if (!resolvedSectionId && (notebookName || sectionName)) {
      if (!notebookName || !sectionName) {
        return res.status(400).json({ ok: false, error: "Provide both notebookName and sectionName, or sectionId." });
      }

      const nb = await graphGET(`/me/onenote/notebooks?$select=id,displayName`);
      const notebooks = nb.value || nb.notebooks || [];
      const targetNb = notebooks.find(
        n => (n.displayName || n.name || "").toLowerCase() === String(notebookName).toLowerCase()
      );
      if (!targetNb) return res.status(404).json({ ok: false, error: `Notebook not found: ${notebookName}` });

      const sec = await graphGET(`/me/onenote/notebooks/${encodeURIComponent(targetNb.id)}/sections?$select=id,displayName`);
      const sections = sec.value || sec.sections || [];
      const targetSec = sections.find(
        s => (s.displayName || s.name || "").toLowerCase() === String(sectionName).toLowerCase()
      );
      if (!targetSec) return res.status(404).json({ ok: false, error: `Section not found: ${sectionName}` });

      resolvedSectionId = targetSec.id; // Graph section id
    }

    if (!resolvedSectionId) {
      return res.status(400).json({ ok: false, error: "No section specified (sectionId or notebookName+sectionName required)." });
    }

    // 5) Build OneNote multipart body
    const boundary = "oneNoteBoundary";
    const body =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="Presentation"\r\n` +
      `Content-Type: text/html\r\n\r\n` +
      `<!DOCTYPE html><html><head><title>${escapeHtml(title)}</title></head>` +
      `<body>${html || "<p></p>"}</body></html>\r\n` +
      `--${boundary}--\r\n`;

    const created = await graphPOST(
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
    return res.status(400).json({ ok: false, error: msg });
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
