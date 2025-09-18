// pages/api/onenote/create-fast.js
// Fast-path create using sectionId (no Graph list calls).
// Body: { sectionId: "...", title: "...", html: "<p>...</p>" }

import { createOneNotePageBySectionId } from "@/lib/msgraph";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  try {
    const { sectionId, title, html } = req.body || {};
    if (!sectionId || !title || !html) {
      return res.status(400).json({ ok: false, error: "Missing sectionId/title/html" });
    }

    // Wrap your HTML into a minimal OneNote page with a H1
    const pageHtml = `
<!DOCTYPE html>
<html>
  <head><title>${escapeHtml(title)}</title><meta charset="utf-8"></head>
  <body>
    ${html}
  </body>
</html>`.trim();

    const page = await createOneNotePageBySectionId(sectionId, pageHtml);
    return res.status(200).json({ ok: true, page });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || "Internal Error" });
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
