// pages/api/onenote/empty-bin.js
import { getBearerFromReq, findNotebook, ensureSection, graphGET, graphDELETE } from "./util";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST" });

  const bearer = getBearerFromReq(req);
  if (!bearer) return res.status(401).json({ ok: false, error: "No access token (header or cookie)" });

  const {
    notebookName = "AliceChatGPT",
    recycleSectionName = "🗑 Recycle Bin"
  } = req.body || {};

  try {
    const nb = await findNotebook(bearer, notebookName);
    const recycle = await ensureSection(bearer, nb.id, recycleSectionName);

    // List pages in the bin section
    const pagesResp = await graphGET(
      bearer,
      `https://graph.microsoft.com/v1.0/me/onenote/sections/${encodeURIComponent(recycle.id)}/pages?$select=id,title`
    );
    if (!pagesResp.ok) throw new Error(`graph GET bin pages -> ${pagesResp.status}: ${JSON.stringify(pagesResp.json)}`);

    const pages = pagesResp.json.value || [];
    const deleted = [];
    const failed = [];

    for (const p of pages) {
      const del = await graphDELETE(bearer, `https://graph.microsoft.com/v1.0/me/onenote/pages/${encodeURIComponent(p.id)}`);
      if (del.ok || del.status === 204) {
        deleted.push({ id: p.id, title: p.title });
      } else {
        failed.push({ id: p.id, title: p.title, error: del.json });
      }
    }

    return res.status(200).json({
      ok: true,
      notebookId: nb.id,
      recycleSectionId: recycle.id,
      deletedCount: deleted.length,
      deleted,
      failed
    });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e.message || e) });
  }
}
