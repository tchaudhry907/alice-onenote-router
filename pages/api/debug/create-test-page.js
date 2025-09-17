// pages/api/debug/create-test-page.js 
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Use POST" });
    return;
  }

  // Accept either Authorization header or cookie (seeded on your server)
  const headerAuth = req.headers.authorization || "";
  const cookieToken = req.cookies?.access_token || "";
  const bearer = headerAuth || (cookieToken ? `Bearer ${cookieToken}` : "");

  if (!bearer) {
    res.status(401).json({ ok: false, error: "No access token (header or cookie)" });
    return;
  }

  // Defaults but allow body to override
  const {
    notebookName = "AliceChatGPT",
    sectionName = "Hobbies",
    title = "[DIAG] Test page",
    html = "<p>Hello from Diagnostics</p>",
  } = (req.body || {});

  try {
    // 1) Notebook lookup
    const nbResp = await fetch("https://graph.microsoft.com/v1.0/me/onenote/notebooks?$select=id,displayName", {
      headers: { Authorization: bearer },
    });
    const nbJson = await safeJson(nbResp);
    if (!nbResp.ok) {
      res.status(200).json({
        ok: false,
        error: `graph GET notebooks -> ${nbResp.status}`,
        details: nbJson,
      });
      return;
    }

    const notebook = (nbJson.value || []).find(
      n => (n.displayName || "").trim().toLowerCase() === notebookName.toLowerCase()
    );
    if (!notebook) {
      res.status(200).json({ ok: false, error: `Notebook not found: ${notebookName}` });
      return;
    }

    // 2) Section lookup
    const secResp = await fetch(
      `https://graph.microsoft.com/v1.0/me/onenote/notebooks/${encodeURIComponent(notebook.id)}/sections?$select=id,displayName`,
      { headers: { Authorization: bearer } }
    );
    const secJson = await safeJson(secResp);
    if (!secResp.ok) {
      res.status(200).json({
        ok: false,
        error: `graph GET sections -> ${secResp.status}`,
        details: secJson,
      });
      return;
    }

    const section = (secJson.value || []).find(
      s => (s.displayName || "").trim().toLowerCase() === sectionName.toLowerCase()
    );
    if (!section) {
      res.status(200).json({ ok: false, error: `Section not found: ${sectionName}` });
      return;
    }

    // 3) Correct OneNote multipart upload
    const boundary = "----AliceDiagBoundary" + Math.random().toString(36).slice(2);
    const htmlDoc = `<!DOCTYPE html><html><head><title>${escapeHtml(title)}</title></head><body>${html}</body></html>`;

    const body =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="Presentation"\r\n` +
      `Content-Type: text/html\r\n\r\n` +
      htmlDoc + `\r\n` +
      `--${boundary}--\r\n`;

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

    const createdJson = await safeJson(createResp);
    if (!createResp.ok) {
      res.status(200).json({
        ok: false,
        error: `graph POST create page -> ${createResp.status}`,
        details: createdJson,
      });
      return;
    }

    res.status(200).json({ ok: true, created: createdJson });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e?.message || e) });
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
}

async function safeJson(resp) {
  // Try to parse JSON; fall back to text so we always return something useful
  const ct = resp.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) return await resp.json();
    const t = await resp.text();
    try { return JSON.parse(t); } catch { return { _text: t }; }
  } catch {
    return { _unparsed: true };
  }
}
