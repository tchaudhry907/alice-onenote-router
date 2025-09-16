// pages/api/graph/create-read-link.js
import { graphGET, graphPOST } from "@/lib/auth";

// HTML body -> OneNote multipart for page creation
function buildMultipartHtml(title, html) {
  const boundary = "oneNoteBoundary_" + Math.random().toString(36).slice(2);
  const parts = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="Presentation"',
    "Content-Type: text/html",
    "",
    `<!DOCTYPE html><html><head><title>${escapeHtml(title || "")}</title></head><body>${html || "<p></p>"}</body></html>`,
    `--${boundary}--`,
    ""
  ];
  return { body: parts.join("\r\n"), boundary };
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const {
      title = "",
      html = "<p></p>",
      sectionId,
      notebookName,
      sectionName
    } = req.body || {};

    let resolvedSectionId = sectionId;

    // Resolve by names if no sectionId provided
    if (!resolvedSectionId &&
