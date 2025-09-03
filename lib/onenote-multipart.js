// lib/onenote-multipart.js
import { lookup as mimeLookup } from "mime-types";

/**
 * Build a multipart/form-data body for Microsoft Graph OneNote create-page.
 * - First part "Presentation" MUST be HTML (text/html).
 * - Subsequent parts are the binary attachments referenced by name in the HTML:
 *     <object data-attachment="my.pdf" data="name:file1" type="application/pdf" />
 *
 * Returns: { body: Buffer, contentType: "multipart/form-data; boundary=..." }
 */
export function buildOneNoteMultipart(html, files = []) {
  const boundary = "----AliceOneNoteRouter" + Math.random().toString(16).slice(2);
  const CRLF = "\r\n";
  const chunks = [];

  // 1) Presentation part (HTML)
  chunks.push(
    Buffer.from(
      `--${boundary}${CRLF}` +
        `Content-Disposition: form-data; name="Presentation"${CRLF}` +
        `Content-Type: text/html${CRLF}${CRLF}` + // text/html is the safest for Graph
        html +
        `${CRLF}`
    )
  );

  // 2) File parts
  (files || []).forEach((f, i) => {
    const name = `file${i + 1}`;
    const filename = f.filename || `file-${i + 1}`;
    const ct = f.mimetype || mimeLookup(filename) || "application/octet-stream";
    chunks.push(
      Buffer.from(
        `--${boundary}${CRLF}` +
          `Content-Disposition: form-data; name="${name}"; filename="${filename}"${CRLF}` +
          `Content-Type: ${ct}${CRLF}${CRLF}`
      )
    );
    chunks.push(Buffer.isBuffer(f.buffer) ? f.buffer : Buffer.from(f.buffer));
    chunks.push(Buffer.from(CRLF));
  });

  // 3) Closing boundary
  chunks.push(Buffer.from(`--${boundary}--${CRLF}`));

  return {
    body: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}
