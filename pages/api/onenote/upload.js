// pages/api/onenote/upload.js
import { IncomingForm } from "formidable";
import fs from "fs/promises";
import { buildOneNoteMultipart } from "@/lib/onenote-multipart";
import { getTokenCookie } from "@/lib/cookie";
import { kv } from "@/lib/kv";
import { refreshAccessToken } from "@/lib/graph";

export const config = {
  api: { bodyParser: false }
};

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "Use POST" });
    }

    // Session check
    const tok = getTokenCookie(req);
    if (!tok?.key) return res.status(401).json({ ok: false, error: "Not authenticated" });
    const refreshToken = await kv.get(tok.key);
    if (!refreshToken) return res.status(401).json({ ok: false, error: "Session expired. Sign in again." });

    // Parse form
    const { fields, files } = await parseForm(req);
    const title = (fields.title || "Uploaded via Alice Router").toString();
    const bodyHtml = (fields.body || "<p>(no body)</p>").toString();

    const fileEntries = Object.values(files || {});
    if (!fileEntries.length) {
      throw new Error("No files uploaded");
    }

    const xhtml = makeXHTML(title, bodyHtml, fileEntries);

    // Build file buffers
    const prepFiles = await Promise.all(
      fileEntries.map(async (f, idx) => {
        // Try filepath/path, otherwise fall back to formidable’s toBuffer()
        let buf;
        if (f.filepath || f.path) {
          const localPath = f.filepath || f.path;
          buf = await fs.readFile(localPath);
        } else if (typeof f.toBuffer === "function") {
          buf = await f.toBuffer();
        } else if (f._writeStream?._buffer) {
          buf = f._writeStream._buffer;
        } else {
          throw new Error("File missing buffer/path");
        }

        return {
          filename: f.originalFilename || `attachment-${idx + 1}`,
          buffer: buf,
          mimetype: f.mimetype || "application/octet-stream"
        };
      })
    );

    const { body, contentType } = buildOneNoteMultipart(xhtml, prepFiles);

    // Token
    const fresh = await refreshAccessToken(refreshToken);
    const access = fresh.access_token;
    if (!access) throw new Error("No access_token from refresh");

    // Target section
    const sectionId = process.env.DEFAULT_SECTION_ID;
    if (!sectionId) throw new Error("DEFAULT_SECTION_ID not set in env");
    const url = `https://graph.microsoft.com/v1.0/me/onenote/sections/${sectionId}/pages`;

    // Send
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access}`,
        "Content-Type": contentType
      },
      body
    });

    const text = await r.text();
    res.status(r.status).setHeader("Content-Type", r.headers.get("content-type") || "application/json").send(text);
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}

function makeXHTML(title, bodyHtml, fileEntries) {
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

function parseForm(req) {
  const form = new IncomingForm({
    multiples: true,
    keepExtensions: true,
    maxFileSize: 30 * 1024 * 1024
  });
  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}
