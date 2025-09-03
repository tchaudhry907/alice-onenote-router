// lib/onenote-multipart.js
import { lookup as mimeLookup } from "mime-types";

/**
 * Build a multipart/related body for OneNote create-page with attachments.
 * - html: application/xhtml+xml "Presentation" part
 * - files: array of { filename, buffer, mimetype? }
 * Returns: { body: Buffer, contentType: "multipart/related; boundary=..." }
 *
 * In your XHTML, reference attachments like:
 *   <object data-attachment="my.pdf" type="application/pdf" data="name:file1"/>
 * …and we’ll send a part with Content-Disposition: form-data; name="file1"
 */
export function buildOneNoteMultipart(html, files = []) {
  const boundary = "----------------" + Math.random().toString(16).slice(2);

  const parts = [];

  // 1) XHTML "Presentation" part
  parts.push(
    Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="Presentation"\r\n` +
        `Content-Type: application/xhtml+xml\r\n\r\n` +
        html +
        `\r\n`
    )
  );

  // 2) File parts
  files.forEach((f, i) => {
    const name = `file${i + 1}`;
    const filename = f.filename || `file-${i + 1}`;
    const ct = f.mimetype || mimeLookup(filename) || "application/octet-stream";
    const header =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${name}"; filename="${filename}"\r\n` +
      `Content-Type: ${ct}\r\n\r\n`;
    parts.push(Buffer.from(header));
    parts.push(Buffer.isBuffer(f.buffer) ? f.buffer : Buffer.from(f.buffer));
    parts.push(Buffer.from("\r\n"));
  });

  // 3) Closing
  parts.push(Buffer.from(`--${boundary}--\r\n`));

  return {
    body: Buffer.concat(parts),
    contentType: `multipart/related; boundary=${boundary}`
  };
}
