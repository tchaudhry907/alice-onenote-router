// pages/api/debug/create-test-page.js

export const config = {
  api: {
    bodyParser: { sizeLimit: "2mb" }, // future-proof if we send bigger HTML
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Use POST" });
  }

  // Accept either a bare token, a full "Authorization: Bearer …" header,
  // or an access_token cookie from /api/debug/tokens/import.
  let bearer = req.headers.authorization || "";
  if (!bearer && req.cookies?.access_token) {
    bearer = `Bearer ${req.cookies.access_token}`;
  }
  // Strip accidental "Authorization:" if it was pasted into a custom header
  if (/^Authorization:/i.test(bearer)) {
    bearer = bearer.replace(/^Authorization:\s*/i, "");
  }
  // Guard against masked tokens (with ellipses)
  if (bearer.includes("…") || bearer.includes("...")) {
    return res
      .status(401)
      .json({ ok: false, error: "Masked token detected — copy the FULL token." });
  }
  if (!/^Bearer\s+/.test(bearer)) bearer = `Bearer ${bearer}`;
  if (!bearer.trim()) {
    return res
      .status(401)
      .json({ ok: false, error: "No access token (header or cookie)" });
  }

  const {
    notebookName = "AliceChatGPT",
    sectionName = "Hobbies",
    title = "[DIAG] Test page",
    html = "<p>Hello from Diagnostics</p>",
  } = req.body || {};

  try {
    // 1) Find notebook
    const nbResp = await fetch(
      "https://graph.microsoft.com/v1.0/me/onenote/notebooks?$select=id,displayName",
      { headers: { Authorization: bearer } }
    );
    const nbJson = await nbResp.json();
    if (!nbResp.ok) {
      throw new Error(
        `graph GET notebooks -> ${nbResp.status}: ${JSON.stringify(nbJson)}`
      );
    }
    const notebook = (nbJson.value || []).find(
      (n) => (n.displayName || "").trim().toLowerCase() === notebookName.toLowerCase()
    );
    if (!notebook) throw new Error(`Notebook not found: ${notebookName}`);

    // 2) Find section
    const secResp = await fetch(
      `https://graph.microsoft.com/v1.0/me/onenote/notebooks/${encodeURIComponent(
        notebook.id
      )}/sections?$select=id,displayName`,
      { headers: { Authorization: bearer } }
    );
    const secJson = await secResp.json();
    if (!secResp.ok) {
      throw new Error(
        `graph GET sections -> ${secResp.status}: ${JSON.stringify(secJson)}`
      );
    }
    const section = (secJson.value || []).find(
      (s) => (s.displayName || "").trim().toLowerCase() === sectionName.toLowerCase()
    );
    if (!section) throw new Error(`Section not found: ${sectionName}`);

    // 3) Build correct multipart for OneNote
    const boundary = "----AliceDiagBoundary" + Math.random().toString(36).slice(2);
    const htmlDoc = `<!DOCTYPE html><html><head><title>${escapeHtml(
      title
    )}</title></head><body>${html}</body></html>`;

    const body =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="Presentation"\r\n` +
      `Content-Type: text/html\r\n\r\n` +
      htmlDoc +
      `\r\n--${boundary}--\r\n`;

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

    const created = await safeJson(createResp);
    if (!createResp.ok) {
      throw new Error(
        `graph POST create page -> ${createResp.status}: ${JSON.stringify(created)}`
      );
    }

    return res.status(200).json({ ok: true, created });
  } catch (e) {
    // If the token is stale, hint the refresh path
    const msg = String(e?.message || e || "");
    const hint =
      /InvalidAuthenticationToken|IDX1410/.test(msg)
        ? "Try Diagnostics → Refresh Tokens, then Seed server, then retry."
        : null;
    return res.status(200).json({ ok: false, error: msg, hint });
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

async function safeJson(resp) {
  try {
    return await resp.json();
  } catch {
    return { text: await resp.text() };
  }
}
