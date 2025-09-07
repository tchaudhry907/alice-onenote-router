// /pages/api/onenote/page-text.js
// GET /api/onenote/page-text?id=<PAGE_ID>  -> returns cached text if present

import { getCachedText } from "@/lib/indexer";

export default async function handler(req, res) {
  const id = (req.query.id || "").toString();
  if (!id) return res.status(400).json({ ok: false, error: "Missing id" });

  const text = await getCachedText(id);
  if (!text) return res.status(404).json({ ok: false, error: "No cached text" });
  return res.status(200).json({ ok: true, id, textSnippet: text.slice(0, 400), length: text.length });
}
