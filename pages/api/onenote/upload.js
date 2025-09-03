// pages/api/onenote/upload.js
import { IncomingForm } from "formidable";
import fs from "fs/promises";
import { buildOneNoteMultipart } from "@/lib/onenote-multipart";
import { getTokenCookie } from "@/lib/cookie";
import { kv } from "@/lib/kv";
import { refreshAccessToken } from "@/lib/graph";

export const config = {
  api: { bodyParser: false } // we parse multipart ourselves
};

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "Use POST" });
    }

    // 1) Ensure user session
    const tok = getTokenCookie(req);
    if (!tok?.key) return res.status(401).json({ ok: false, error: "Not authenticated" });
    const refreshToken = await kv.get(tok.key);
    if (!refreshToken) return res.status(401).json({ ok: false, error: "Session expired. Sign in again." });

    // 2) Parse multipart/form-data from browser
    const { fields, files } = await parseForm(req);

    const title = (fields.title || "Uploaded via Alice Router").toString();
    const bodyHtml = (fields.body || "<p>(no body)</p>").toString();

    // 3) Build XHTML with attachment tags for each file
    const fileEntries = Object.values(files || {});
    const xhtml = makeXHTML(title, bodyHtml, fileEntries);

    // 4) Build OneNote multipart/related body
    const prepFiles = await Promise.all(
      fileEntries.map(async (f, idx) => {
        const buf = await fs.readFile(f.filepath);
        return {
          filename: f.originalFilename || `attachment-${idx + 1}`,
          buffer: buf,
          mimetype: f.mimetype || "application/octet-stream"
        };
      })
    );
    const { body, contentType } = buildOneNoteMultipart(xhtml, prepFiles);

    // 5) Fresh access token
    const fresh = await refreshAccessToken(refreshToken);
    const access = fresh.access_token;
    if (!access) throw new Error("No access_token from refresh");

    // 6) Target URL (SECTION_ID placeholder -> env)
    const sectionId = process.env.DEFAULT_SECTION_ID;
    if (!sectionId) throw new Error("DEFAULT_SECTION_ID not set in env");
    const url = `https://graph.microsoft.com/v1.0/me/onenote/sections/${sectionId}/pages`;

    // 7) Send to Microsoft Graph
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access}`,
        "Content-Type": contentType
      },
      body
    });

    const text = await r.text();
    // Graph returns JSON on success (201)
    res.status(r.status).setHeader("Content-Type", r.headers.get("content-type") || "application/json").send(text);
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}

function makeXHTML(title, bodyHtml, fileEntries) {
  // For each file, add an <object> that refers to "name:fileN"
  // Users can edit the body to position these however they want.
  const attachmentTags = fileEntries
    .map((f, i) => {
      const name = `file${i + 1}`;
      const filename = (f.originalFilename || `attachment-${i + 1}`).replace(/"/g, "");
      const type = f.mimetype || "application/octet-stream";
      return `<p><object data-attachment="${escapeHtml(filename)}" data="name:${name}" type="${escapeHtml(type)}" /></p>`;
    })
    .join("\n");

  return `
<html xmlns="http://www.w3.org/1999/xhtml">
  <head><title>${escapeHtml(title)}</title></head>
  <body>
    ${bodyHtml}
    ${attachmentTags}
    <p style="color:#666;font-size:12px">Uploaded via Alice Router at ${new Date().toISOString()}</p>
  </body>
</html>`.trim();
}

function escapeHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ---- multipart parser (formidable) ----
function parseForm(req) {
  const form = new IncomingForm({
    multiples: true,
    keepExtensions: true,
    maxFileSize: 30 * 1024 * 1024 // 30MB (OneNote limit per file is typically ~19MB, but keep higher here)
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}
