// pages/api/graph/sections-create-batch.js
import { getBearerFromReq, graphGET, graphPOST } from "@/lib/auth";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const token = getBearerFromReq(req);
    if (!token) {
      return res.status(401).json({ ok: false, error: "Missing access token (send Authorization: Bearer …)" });
    }

    const { notebookName, sectionNames = [] } = req.body || {};
    if (!notebookName || !Array.isArray(sectionNames) || sectionNames.length === 0) {
      return res.status(400).json({ ok: false, error: "Provide { notebookName, sectionNames: [..] }" });
    }

    const nbRes = await graphGET(token, `/me/onenote/notebooks?$select=id,displayName`);
    const notebooks = nbRes.value || nbRes.notebooks || [];
    const nb = notebooks.find(
      (n) => (n.displayName || n.name || "").toLowerCase() === String(notebookName).toLowerCase()
    );
    if (!nb) {
      return res.status(404).json({ ok: false, error: `Notebook not found: ${notebookName}` });
    }

    const existingSecRes = await graphGET(token, `/me/onenote/notebooks/${nb.id}/sections?$select=id,displayName`);
    const existing = (existingSecRes.value || existingSecRes.sections || []).map(s => ({
      id: s.id,
      name: (s.displayName || s.name || "").toLowerCase()
    }));

    const created = [];
    const skipped = [];

    for (const s of sectionNames) {
      const target = String(s || "").trim();
      if (!target) continue;
      const lower = target.toLowerCase();
      const already = existing.find((e) => e.name === lower);
      if (already) {
        skipped.push({ name: target, id: already.id });
        continue;
      }
      const r = await graphPOST(token, `/me/onenote/notebooks/${nb.id}/sections`, { displayName: target });
      created.push({ name: r?.displayName || target, id: r?.id || null });
    }

    return res.status(200).json({ ok: true, notebookId: nb.id, created, skipped });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = err?.status || 500;
    return res.status(code).json({ ok: false, error: msg });
  }
}
