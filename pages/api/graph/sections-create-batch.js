// /pages/api/graph/sections-create-batch.js
import { getBearerFromReq, findNotebookByName, ensureSectionsBatch } from "@/lib/graph";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST" });

  try {
    const bearer = getBearerFromReq(req);
    if (!bearer) return res.status(401).json({ ok: false, error: "No access token" });

    const { notebookName, sectionNames } = req.body || {};
    if (!notebookName || !Array.isArray(sectionNames) || sectionNames.length === 0) {
      return res.status(400).json({ ok: false, error: "notebookName and non-empty sectionNames[] required" });
    }

    const nb = await findNotebookByName(bearer, notebookName);
    if (!nb) return res.status(404).json({ ok: false, error: `Notebook not found: ${notebookName}` });

    const result = await ensureSectionsBatch(bearer, nb.id, sectionNames);
    return res.status(200).json({ ok: true, notebookId: nb.id, ...result });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e.message || e) });
  }
}
