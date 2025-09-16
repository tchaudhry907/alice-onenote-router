// pages/api/debug/create-test-page.js
// Creates a small OneNote page in AliceChatGPT / Hobbies.
// Accepts either Authorization header or access_token cookie.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Use POST" });
  }

  const bearer =
    req.headers.authorization ||
    (req.cookies?.access_token ? `Bearer ${req.cookies.access_token}` : "");

  if (!bearer) {
    return res.status(401).json({ ok: false, error: "No access token (header or cookie)" });
  }

  const {
    notebookName = "AliceChatGPT",
    sectionName = "Hobbies",
    title = "[DIAG] Test page",
    html = "<p>Hello from Diagnostics</p>",
  } = (req.body || {});

  try {
    // 1) Get notebooks
    const nbResp = await fetch(
      "https://graph.microsoft.com/v1.0/me/onenote/notebooks?$select=id,displayName",
      { headers: { Authorization: bearer } }
    );
    const nbJson = await nbResp.json();
    if (!nbResp.ok) {
      throw new Error(`graph GET notebooks -> ${nbResp.status}: ${stringify(nbJson)}`);
    }

    const notebook = (nbJson.value || []).find(
      n => (n.displayName || "").trim().toLowerCase() === notebookName.toLowerCase()
    );
    if (!notebook) throw new Error(`Notebook not found: ${notebookName}`);

    // 2) Get sections in that notebook
    const secResp = await fetch(
      `https://graph.microsoft.com/v1.0/me/onenote/notebooks/${encodeURIComponent(
        notebook.id
      )}/sections?$select=id,displayName`,
      { headers: { Authorization: bearer } }
    );
    const secJson = await secResp.json();
    if (!secResp.ok) {
      throw new Error(`graph GET sections -> ${secResp.status}: ${stringify(secJson)}`);
    }

    const section = (secJson.value || []).find(
      s => (s.displayName || "").trim().toLowerCase() === sectionName.toLowerCase()
    );
    if (!section) throw new Error(`Section not found: ${sectionName}`);

    // 3) Build correct multipart body (CRLF + boundary)
    const boundary = "----AliceDiagBoundary" + Math.random().toString(36).slice(2);
    const htmlDoc =
      `<!DOCTYPE html><html><head><title>${escapeHtml(title)}</title></head><body>${html}</body></html>`;

    const body =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="Presentation"\r\n` +
      `Content-Type: text/html\r\n\r\n` +
      htmlDoc + `\r\n` +
      `--${boundary}--\r\n`;

    // 4) Create the page
    const createResp = await fetch(
      `https://graph.microsoft.com/v1.0/me/onenote/sections/${encodeURIComponent(
        section.id
      )}/pages`,
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
      throw new Error(`graph POST create page -> ${createResp.status}: ${stringify(created)}`);
    }

    return res.status(200).json({ ok: true, created });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e?.message || e) });
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function stringify(x) {
  try { return JSON.stringify(x); } catch { return String(x); }
}
