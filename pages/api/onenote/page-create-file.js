// /pages/api/onenote/page-create-file.js
// Create a OneNote page in the DEFAULT_SECTION_ID with ONE attachment.
// Accepts JSON: { title, body, file: { name, type, dataBase64 } }

import { requireAuth } from "@/lib/auth";
import { kv } from "@/lib/kv";

export const config = {
  api: {
    bodyParser: true, // we accept JSON; client will send JSON, not multipart
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Use POST" });
  }

  const auth = await requireAuth(req, res);
  if (!auth) return;

  try {
    const { title, body, file } = parseBody(req.body);

    const sectionId = process.env.DEFAULT_SECTION_ID;
    if (!sectionId) {
      return res.status(500).json({ ok: false, error: "DEFAULT_SECTION_ID not set" });
    }

    // Build the HTML "Presentation" part. We reference the attachment with name:file1
    const safeTitle = escapeHtml(title || "Alice Router — Upload with Attachment");
    const html =
      `<!DOCTYPE html><html><head><title>${safeTitle}</title></head><body>` +
      (body || "<p>Hello from Alice Router with a file attached.</p>") +
      (file
        ? `\n<object data-attachment="${escapeHtml(file.name)}" data="name:file1" type="${escapeHtml(file.type || "application/octet-stream")}"></object>`
        : "") +
      `\n</body></html>`;

    const boundary = "----AliceOneNoteBoundary" + Math.random().toString(16).slice(2);
    const mp = [];

    // Part 1: Presentation
    mp.push(Buffer.from(`--${boundary}\r\n`, "utf8"));
    mp.push(Buffer.from(`Content-Disposition: form-data; name="Presentation"\r\n`, "utf8"));
    mp.push(Buffer.from(`Content-Type: text/html\r\n\r\n`, "utf8"));
    mp.push(Buffer.from(html, "utf8"));
    mp.push(Buffer.from(`\r\n`, "utf8"));

    // Part 2: file (optional)
    if (file) {
      const fileBuf = Buffer.from(file.dataBase64, "base64");
      const contentType = file.type || "application/octet-stream";
      const filename = file.name || "attachment.bin";

      mp.push(Buffer.from(`--${boundary}\r\n`, "utf8"));
      mp.push(
        Buffer.from(
          `Content-Disposition: form-data; name="file1"; filename="${escapeHeader(filename)}"\r\n`,
          "utf8"
        )
      );
      mp.push(Buffer.from(`Content-Type: ${contentType}\r\n\r\n`, "utf8"));
      mp.push(fileBuf);
      mp.push(Buffer.from(`\r\n`, "utf8"));
    }

    // Closing boundary
    mp.push(Buffer.from(`--${boundary}--\r\n`, "utf8"));
    const bodyBuffer = Buffer.concat(mp);

    const url = `https://graph.microsoft.com/v1.0/me/onenote/sections/${encodeURIComponent(
      sectionId
    )}/pages`;

    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body: bodyBuffer,
    });

    const text = await r.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // Graph may return text on error; surface it
    }

    if (r.status === 201 && json?.id) {
      // write lastPageId for downstream flows
      await kv.set("alice:lastPageId", json.id, { ex: 60 * 60 * 24 * 30 });
    }

    // Always return JSON when possible
    if (json) return res.status(r.status).json(json);
    return res.status(r.status).send(text);
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

function parseBody(b) {
  if (!b || typeof b !== "object") return { title: "", body: "", file: null };
  const title = typeof b.title === "string" ? b.title : "";
  const body = typeof b.body === "string" ? b.body : "";
  let file = null;
  if (b.file && typeof b.file === "object") {
    const name = typeof b.file.name === "string" ? b.file.name : "attachment.bin";
    const type = typeof b.file.type === "string" ? b.file.type : "application/octet-stream";
    const dataBase64 = typeof b.file.dataBase64 === "string" ? b.file.dataBase64 : "";
    if (dataBase64) file = { name, type, dataBase64 };
  }
  return { title, body, file };
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeHeader(s) {
  // very conservative for header-safe filename
  return String(s).replace(/"/g, "");
}
