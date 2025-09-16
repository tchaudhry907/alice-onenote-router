// /pages/api/onenote/upload.js
import { getBearerFromReq, buildOneNoteHtmlMultipart, graphPOST } from "@/lib/graph";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST" });
  try {
    const bearer = getBearerFromReq(req);
    if (!bearer) return res.status(401).json({ ok: false, error: "No access token" });

    const { sectionId, title, html } = req.body || {};
    if (!sectionId) return res.status(400).json({ ok: false, error: "sectionId required" });

    const { body, contentType } = buildOneNoteHtmlMultipart({ title, html });
    const created = await graphPOST(
      `https://graph.microsoft.com/v1.0/me/onenote/sections/${encodeURIComponent(sectionId)}/pages`,
      bearer,
      body,
      { "Content-Type": contentType }
    );
    return res.status(200).json({ ok: true, created });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e.message || e) });
  }
}
