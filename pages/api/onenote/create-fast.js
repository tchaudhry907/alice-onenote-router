// pages/api/onenote/create-fast.js
import { createOneNotePageBySectionId } from "@/lib/msgraph.js";

/**
 * Minimal working handler.
 * Expects POST with JSON: { accessToken, sectionId, html? }
 * Returns Graph response JSON or a clear error.
 */
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "Method Not Allowed" });
    }

    const { accessToken, sectionId, html } = req.body || {};
    if (!accessToken || !sectionId) {
      return res.status(400).json({
        ok: false,
        error: "Missing required fields: accessToken, sectionId"
      });
    }

    const result = await createOneNotePageBySectionId(accessToken, sectionId, html);
    return res.status(200).json({ ok: true, result });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
