// pages/api/graph/sections-create-batch.js
import { getBearerFromReq, graphGET, graphPOST } from "@/lib/auth";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST" });

  try {
    const bearer = getBearerFromReq(req);
    if (!bearer) return res.status(401).json({ ok: false, error: "No access token (header or cookie)" });

    const { notebookName, sectionNames } = req.body || {};
    if (!notebookName || !Array.isArray(sectionNames) || sectionNames.length === 0) {
      return res.status(400).json({ ok: false, error: "notebookName and non-empty sectionNames[] required" });
    }

    // 1) Find notebook
    const nbs = await graphGET("https://graph.microsoft.com/v1.0/me/onenote/notebooks?$select=id,displayName", bearer);
    const notebook = (nbs.value || []).find(n => (n.displayName || "").trim().toLowerCase() === notebookName.toLowerCase());
    if (!notebook) return res.status(404).json({ ok: false, error: `Notebook not found: ${notebookName}` });

    // 2) Existing sections
    const secs = await graphGET(`https://graph.microsoft.com/v1.0/me/onenote/notebooks/${encodeURIComponent(notebook.id)}/sections?$select=id,displayName`, bearer);
    const existingNames = new Set((secs.value || []).map(s => (s.displayName || "").trim().toLowerCase()));

    // 3) Create missing
    const created = [];
    const skipped = [];
    for (const name of sectionNames) {
      const key = String(name || "").trim();
      if (!key) continue;
      if (existingNames.has(key.toLowerCase())) {
        skipped.push({ name: key });
        continue;
      }
      const body = JSON.stringify({ displayName: key });
      const j = await graphPOST(
        `https://graph.microsoft.com/v1.0/me/onenote/notebooks/${encodeURIComponent(notebook.id)}/sections`,
        body,
        bearer,
        { "Content-Type": "application/json" }
      );
      created.push({ name: key, id: j.id });
    }

    return res.status(200).json({ ok: true, notebookId: notebook.id, created, skipped });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e.message || e) });
  }
}
