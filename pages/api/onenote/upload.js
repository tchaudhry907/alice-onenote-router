// pages/api/onenote/upload.js
import { IncomingForm } from "formidable";
import fs from "fs/promises";
import { buildOneNoteMultipart } from "@/lib/onenote-multipart";
import { getTokenCookie } from "@/lib/cookie";
import { kv } from "@/lib/kv";
import { refreshAccessToken } from "@/lib/graph";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "Use POST" });
    }

    const tok = getTokenCookie(req);
    if (!tok?.key) return res.status(401).json({ ok: false, error: "Not authenticated" });
    const refreshToken = await kv.get(tok.key);
    if (!refreshToken) return res.status(401).json({ ok: false, error: "Session expired. Sign in again." });

    const { fields, files } = await parseFormToTmp(req);

    const title = (fields.title || "Uploaded via Alice Router").toString();
    const bodyHtml = (fields.body || "<p>(no body)</p>").toString();

    const fileEntries = Object.values(files || {}).flatMap(v => Array.isArray(v) ? v : [v]).filter(Boolean);
    if (!fileEntries.length) throw new Error("No files uploaded");

    const xhtml = makeXHTML(title, bodyHtml, fileEntries);

    const prepFiles = await Promise.all(
      fileEntries.map(async (f, idx) => {
        const filepath = f.filepath || f.path;
        if (!filepath) throw new Error("File missing filepath (upload dir not set?)");
        const buffer = await fs.readFile(filepath);
        return {
          filename: f.originalFilename || `attachment-${idx + 1}`,
          buffer,
          mimetype: f.mimetype || "application/octet-stream",
        };
      })
    );

    const { body, contentType } = buildOneNoteMultipart(xhtml, prepFiles);

    const fresh = await refreshAccessToken(refreshToken);
    const access = fresh.access_token;

    const sectionId = process.env.DEFAULT_SECTION_ID;
    if (!sectionId) throw new Error("DEFAULT_SECTION_ID not set in env");
    const url = `https://graph.microsoft.com/v1.0/me/onenote/sections/${sectionId}/pages`;

    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${access}`, "Content-Type": contentType },
      body
    });

    const text = await r.text();

    // Save last page id for automation
    try {
      if (r.ok) {
        const data = JSON.parse(text);
        if (data?.id) {
          await kv.set("alice:lastPageId", data.id);
          await kv.lpush?.("alice:lastPageIds", data.id);
          await kv.ltrim?.("alice:lastPageIds", 0, 19);
        }
      }
    } catch (_) {}

    res.status(r.status).setHeader("Content-Type", r.headers.get("content-type") || "application/json").send(text);
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}

function makeXHTML(title, bodyHtml, fileEntries) {
  const banner = `
    <div style="background:#ecfdf5;border:1px solid #86efac;padding:10px 12px;border-radius:8px;margin:10px 0">
      <b>Uploaded via Alice Router ✅</b>
      <div style="color:#555;font-size:12px">at ${new Date().toISOString()}</div>
    </div>`;

  const fileList = (fileEntries || [])
    .map((f, i) => `<li>${escapeHtml(f?.originalFilename || `attachment-${i + 1}`)}</li>`)
    .join("");

  const attachmentTags = (fileEntries || [])
    .map((f, i) => {
      const name = `file${i + 1}`;
      const filename = (f?.originalFilename || `attachment-${i + 1}`).replace(/"/g, "");
      return `<p><object data-attachment="${escapeHtml(filename)}" data="name:${name}" /></p>`;
    })
    .join("\n");

  return `
<html xmlns="http://www.w3.org/1999/xhtml">
  <head><title>${escapeHtml(title)}</title></head>
  <body>
    ${banner}
    ${bodyHtml}
    ${fileList ? `<p><b>Attachments:</b></p><ul>${fileList}</ul>` : ""}
    ${attachmentTags}
  </body>
</html>`.trim();
}

function escapeHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function parseFormToTmp(req) {
  const form = new IncomingForm({
    multiples: true,
    keepExtensions: true,
    uploadDir: "/tmp",
    allowEmptyFiles: false,
    maxFileSize: 30 * 1024 * 1024
  });
  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => err ? reject(err) : resolve({ fields, files }));
  });
}
