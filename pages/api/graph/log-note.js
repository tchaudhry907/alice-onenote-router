// pages/api/graph/log-note.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST" });

  const bearer =
    req.headers.authorization ||
    (req.cookies?.access_token ? `Bearer ${req.cookies.access_token}` : "");

  if (!bearer) return res.status(401).json({ ok: false, error: "No access token (header or cookie)" });

  const {
    notebookName = "AliceChatGPT",
    sectionName,
    title = "[LOG] Note",
    html = "<p>(empty)</p>",
  } = req.body || {};

  if (!sectionName) {
    return res.status(200).json({ ok: false, error: "sectionName required" });
  }

  try {
    // 1) Notebook lookup
    const nbResp = await fetch(
      "https://graph.microsoft.com/v1.0/me/onenote/notebooks?$select=id,displayName",
      { headers: { Authorization: bearer } }
    );
    const nbJson = await nbResp.json();
    if (!nbResp.ok) throw new Error(`graph GET notebooks -> ${nbResp.status}: ${JSON.stringify(nbJson)}`);

    const notebook = (nbJson.value || []).find(
      (n) => (n.displayName || "").trim().toLowerCase() === notebookName.toLowerCase()
    );
    if (!notebook) throw new Error(`Notebook not found: ${notebookName}`);

    // 2) Section lookup
    const secResp = await fetch(
      `https://graph.microsoft.com/v1.0/me/onenote/notebooks/${encodeURIComponent(
        notebook.id
      )}/sections?$select=id,displayName`,
      { headers: { Authorization: bearer } }
    );
    const secJson = await secResp.json();
    if (!secResp.ok) throw new Error(`graph GET sections -> ${secResp.status}: ${JSON.stringify(secJson)}`);

    const section = (secJson.value || []).find(
      (s) => (s.displayName || "").trim().toLowerCase() === sectionName.toLowerCase()
    );
    if (!section) throw new Error(`Section not found: ${sectionName}`);

    // 3) Create page (multipart)
    const boundary = "----AliceLogBoundary" + Math.random().toString(36).slice(2);
    const htmlDoc = `<!DOCTYPE html><html><head><title>${esc(title)}</title></head><body>${html}</body></html>`;
    const body =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="Presentation"\r\n` +
      `Content-Type: text/html\r\n\r\n` +
      htmlDoc +
      `\r\n--${boundary}--\r\n`;

    const createResp = await fetch(
      `https://graph.microsoft.com/v1.0/me/onenote/sections/${encodeURIComponent(section.id)}/pages`,
      {
        method: "POST",
        headers: {
          Authorization: bearer,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body,
      }
    );

    // Graph returns 201 + JSON payload (links, ids)
    const created = await createResp.json().catch(() => ({}));
    if (!createResp.ok) {
      throw new Error(`graph POST create page -> ${createResp.status}: ${JSON.stringify(created)}`);
    }

    return res.status(200).json({ ok: true, created });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e.message || e) });
  }
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
