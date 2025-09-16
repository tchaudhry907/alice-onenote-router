// pages/api/graph/sections-create-batch.js
import { graphGET, graphPOST } from "@/lib/auth";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  try {
    const { notebookName, sectionNames } = req.body || {};
    if (!notebookName || !Array.isArray(sectionNames) || sectionNames.length === 0) {
      return res.status(400).json({ ok: false, error: "notebookName and sectionNames[] required" });
    }

    // find notebook
    const nbRes = await graphGET(req, `/me/onenote/notebooks?$select=id,displayName`);
    const notebooks = nbRes.value || [];
    const nb = notebooks.find(n => (n.displayName || "").toLowerCase() === notebookName.toLowerCase());
    if (!nb) return res.status(404).json({ ok: false, error: `Notebook not found: ${notebookName}` });

    // get existing sections
    const secRes = await graphGET(req, `/me/onenote/notebooks/${encodeURIComponent(nb.id)}/sections?$select=id,displayName`);
    const existing = (secRes.value || []).map(s => ({ id: s.id, name: s.displayName }));

    const created = [];
    const skipped = [];

    for (const name of sectionNames) {
      const already = existing.find(s => (s.name || "").toLowerCase() === String(name).toLowerCase());
      if (already) {
        skipped.push({ name, id: already.id });
        continue;
      }
      const made = await graphPOST(req, `/me/onenote/notebooks/${encodeURIComponent(nb.id)}/sections`, {
        displayName: String(name)
      });
      created.push({ name, id: made?.id || null });
    }

    return res.status(200).json({ ok: true, notebookId: nb.id, created, skipped });
  } catch (err) {
    const msg = err?.message || String(err);
    return res.status(err?.status || 500).json({ ok: false, error: msg });
  }
}
