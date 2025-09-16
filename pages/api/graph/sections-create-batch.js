// pages/api/graph/sections-create-batch.js
import { getBearer, graphGET, graphPOST } from "@/lib/graph";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST" });

  const bearer = getBearer(req);
  if (!bearer) return res.status(401).json({ ok: false, error: "No access token (header or cookie)" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { notebookName, sectionNames } = body;

    if (!notebookName || !Array.isArray(sectionNames) || sectionNames.length === 0) {
      return res.status(200).json({ ok: false, error: "notebookName and non-empty sectionNames[] required" });
    }

    // Notebook
    const nbJson = await graphGET(
      "https://graph.microsoft.com/v1.0/me/onenote/notebooks?$select=id,displayName",
      bearer
    );
    const notebook = (nbJson.value || []).find(
      n => (n.displayName || "").trim().toLowerCase() === notebookName.trim().toLowerCase()
    );
    if (!notebook) throw new Error(`Notebook not found: ${notebookName}`);

    // Existing sections
    const secJson = await graphGET(
      `https://graph.microsoft.com/v1.0/me/onenote/notebooks/${encodeURIComponent(notebook.id)}/sections?$select=id,displayName`,
      bearer
    );
    const existing = new Map((secJson.value || []).map(s => [s.displayName.toLowerCase(), s]));

    const created = [];
    const skipped = [];

    for (const name of sectionNames) {
      const key = String(name).trim().toLowerCase();
      if (!key) continue;
      if (existing.has(key)) {
        skipped.push({ name, id: existing.get(key).id });
        continue;
      }
      const j = await graphPOST(
        `https://graph.microsoft.com/v1.0/me/onenote/notebooks/${encodeURIComponent(notebook.id)}/sections`,
        bearer,
        JSON.stringify({ displayName: name }),
        { "Content-Type": "application/json" }
      );
      created.push({ name: j.displayName, id: j.id });
    }

    return res.status(200).json({ ok: true, notebookId: notebook.id, created, skipped });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e.message || e) });
  }
}
