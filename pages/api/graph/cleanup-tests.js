// pages/api/graph/cleanup-tests.js
import { getBearerFromReq, graphGET, graphDELETE } from "@/lib/auth";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST" });

  try {
    const bearer = getBearerFromReq(req);
    if (!bearer) return res.status(401).json({ ok: false, error: "No access token (header or cookie)" });

    // configurable via body if you want
    const {
      notebookName = "AliceChatGPT",
      maxPages = 200,
      titlePrefixes = ["[DIAG]", "[WORKOUT]", "[HOBBY]", "[STEPS]", "[INBOX] quick note"],
    } = req.body || {};

    // find notebook (so we can optionally limit by it later if needed)
    const nbs = await graphGET("https://graph.microsoft.com/v1.0/me/onenote/notebooks?$select=id,displayName", bearer);
    const notebook = (nbs.value || []).find(n => (n.displayName || "").trim().toLowerCase() === notebookName.toLowerCase());
    if (!notebook) return res.status(404).json({ ok: false, error: `Notebook not found: ${notebookName}` });

    // Get recent pages (largest allowed page is fine; we filter client-side)
    // NOTE: orderby createdDateTime desc is supported; keep it simple and robust.
    const pages = await graphGET(
      `https://graph.microsoft.com/v1.0/me/onenote/pages?$top=${encodeURIComponent(maxPages)}&$orderby=createdDateTime desc`,
      bearer
    );

    const isTestTitle = (t = "") => titlePrefixes.some(p => (t || "").startsWith(p));

    // Keep only pages within our notebook (parsing parentSection/notebook if present)
    const candidates = (pages.value || []).filter(p => {
      const title = p.title || "";
      if (!isTestTitle(title)) return false;
      // Prefer matching parentNotebook id if available; otherwise keep it (still safe cleanup).
      const nb = p.parentNotebook || {};
      return !nb.id || String(nb.id).includes(notebook.id) || String(notebook.id).includes(nb.id);
    });

    const deleted = [];
    const failed = [];

    for (const pg of candidates) {
      try {
        await graphDELETE(`https://graph.microsoft.com/v1.0/me/onenote/pages/${encodeURIComponent(pg.id)}`, bearer);
        deleted.push({ id: pg.id, title: pg.title });
      } catch (err) {
        failed.push({ id: pg.id, title: pg.title, error: String(err.message || err) });
      }
    }

    return res.status(200).json({
      ok: true,
      scanned: (pages.value || []).length,
      considered: candidates.length,
      deleted,
      failed,
    });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e.message || e) });
  }
}
