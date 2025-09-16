// pages/api/graph/create-read-link.js
// Creates a OneNote page and returns OneNote links.
// Accepts either Authorization header OR an `access_token` cookie.
// Supports either { sectionId } OR { notebookName, sectionName }.

// Helper: safe JSON stringify
function s(x) { try { return JSON.stringify(x); } catch { return String(x); } }
function escapeHtml(v) {
  return String(v).replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Use POST" });
  }

  // 0) Auth: header OR cookie
  const bearer =
    req.headers.authorization ||
    (req.cookies?.access_token ? `Bearer ${req.cookies.access_token}` : "");
  if (!bearer) return res.status(401).json({ ok: false, error: "No access token" });

  // 1) Input
  const {
    // choose ONE of these two paths:
    sectionId,
    notebookName,
    sectionName,

    // content
    title = "[Untitled]",
    html = "<p>(empty)</p>",
  } = (req.body || {});

  try {
    // 2) Resolve sectionId if only names were provided
    let resolvedSectionId = sectionId;
    if (!resolvedSectionId) {
      if (!notebookName || !sectionName) {
        return res.status(400).json({
          ok: false,
          error: "No section specified (sectionId OR notebookName+sectionName required).",
        });
      }

      // 2a) find notebook
      const nbResp = await fetch(
        "https://graph.microsoft.com/v1.0/me/onenote/notebooks?$select=id,displayName",
        { headers: { Authorization: bearer } }
      );
      const nbJson = await nbResp.json();
      if (!nbResp.ok) throw new Error(`graph GET notebooks -> ${nbResp.status}: ${s(nbJson)}`);

      const notebook = (nbJson.value || []).find(
        n => (n.displayName || "").trim().toLowerCase() === notebookName.trim().toLowerCase()
      );
      if (!notebook) throw new Error(`Notebook not found: ${notebookName}`);

      // 2b) find section inside notebook
      const secResp = await fetch(
        `https://graph.microsoft.com/v1.0/me/onenote/notebooks/${encodeURIComponent(
          notebook.id
        )}/sections?$select=id,displayName`,
        { headers: { Authorization: bearer } }
      );
      const secJson = await secResp.json();
      if (!secResp.ok) throw new Error(`graph GET sections -> ${secResp.status}: ${s(secJson)}`);

      const section = (secJson.value || []).find(
        sct => (sct.displayName || "").trim().toLowerCase() === sectionName.trim().toLowerCase()
      );
      if (!section) throw new Error(`Section not found: ${sectionName}`);
      resolvedSectionId = section.id;
    }

    // 3) Build correct multipart body (CRLF with custom boundary)
    const boundary = "----AliceCreateBoundary" + Math.random().toString(36).slice(2);
    const htmlDoc =
      `<!DOCTYPE html><html><head><title>${escapeHtml(title)}</title></head>` +
      `<body>${html}</body></html>`;

    const body =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="Presentation"\r\n` +
      `Content-Type: text/html\r\n\r\n` +
      htmlDoc + `\r\n` +
      `--${boundary}--\r\n`;

    // 4) Create page
    const createResp = await fetch(
      `https://graph.microsoft.com/v1.0/me/onenote/sections/${encodeURIComponent(resolvedSectionId)}/pages`,
      {
        method: "POST",
        headers: {
          Authorization: bearer,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body,
      }
    );

    const created = await createResp.json();
    if (!createResp.ok) {
      // Surface Graph error clearly
      throw new Error(`graph POST create page -> ${createResp.status}: ${s(created)}`);
    }

    // 5) Return links in a stable shape
    // created.links.oneNoteClientUrl / oneNoteWebUrl may already exist; if not, compute nothing
    return res.status(200).json({
      ok: true,
      created,
      links: created.links || undefined,
    });
  } catch (e) {
    // Keep 200 with ok:false so the UI can show the message without a network error
    return res.status(200).json({ ok: false, error: String(e?.message || e) });
  }
}
