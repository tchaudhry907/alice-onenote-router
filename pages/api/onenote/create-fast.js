// pages/api/onenote/create-fast.js
import { createOneNotePageBySectionId } from "@/lib/msgraph";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }
  try {
    const body = typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
    const sectionId = String(body.sectionId || "").trim();
    const html = String(body.html || "").trim();
    if (!sectionId) return res.status(400).json({ ok: false, error: "Missing sectionId" });
    if (!html) return res.status(400).json({ ok: false, error: "Missing html" });
    const data = await createOneNotePageBySectionId(sectionId, html);
    return res.status(200).json({ ok: true, data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
