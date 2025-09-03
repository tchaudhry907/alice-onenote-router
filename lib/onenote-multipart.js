// lib/onenote-multipart.js
import { lookup as mimeLookup } from "mime-types";

/**
 * Build multipart/form-data:
 *  - First part name="Presentation" with text/html
 *  - Subsequent parts: name="fileN" with binary
 */
export function buildOneNoteMultipart(html, files = []) {
  const boundary = "----AliceOneNoteRouter" + Math.random().toString(16).slice(2);
  const CRLF = "\r\n";
  const chunks = [];

  // Presentation part
  chunks.push(Buffer.from(
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="Presentation"${CRLF}` +
    `Content-Type: text/html${CRLF}${CRLF}` +
    html + CRLF
  ));

  // Files
  (files || []).forEach((f, i) => {
    const name = `file${i + 1}`;
    const filename = f.filename || `file-${i + 1}`;
    const ct = f.mimetype || mimeLookup(filename) || "application/octet-stream";
    chunks.push(Buffer.from(
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="${name}"; filename="${filename}"${CRLF}` +
      `Content-Type: ${ct}${CRLF}${CRLF}`
    ));
    chunks.push(Buffer.isBuffer(f.buffer) ? f.buffer : Buffer.from(f.buffer));
    chunks.push(Buffer.from(CRLF));
  });

  // Close
  chunks.push(Buffer.from(`--${boundary}--${CRLF}`));

  return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}
