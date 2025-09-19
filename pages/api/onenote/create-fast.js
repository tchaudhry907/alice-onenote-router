// pages/api/onenote/create-fast.js
import { createOneNotePageBySectionId } from "@/lib/msgraph";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  try {
    const body = req.body && typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
    const sectionId = String(body.sectionId || "").trim();
    const html = String(body.html || "").trim();

    if (!sectionId) return res.status(400).json({ ok: false, error: "Missing sectionId" });
    if (!html) return res.status(400).json({ ok: false, error: "Missing html" });

    const result = await createOneNotePageBySectionId(sectionId, html);
    return res.status(200).json({ ok: true, result });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
