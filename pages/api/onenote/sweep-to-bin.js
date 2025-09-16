// pages/api/onenote/sweep-to-bin.js
import { getBearerFromReq, findNotebook, ensureSection, graphGET, graphPATCH } from "./util";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST" });

  const bearer = getBearerFromReq(req);
  if (!bearer) return res.status(401).json({ ok: false, error: "No access token (header or cookie)" });

  // Allow overrides via POST body, but default to your notebook + common test markers
  const {
    notebookName = "AliceChatGPT",
    // titles that clearly came from our earlier testing
    titlePrefixes = ["[DIAG]", "[WORKOUT]", "[HOBBY]", "[INBOX] quick note", "[STEPS]"],
    // “age” filter: only sweep recent pages (ISO date string or null)
    createdAfter = null, // e.g., "2025-09-15"
    // destination section name
    recycleSectionName = "🗑 Recycle Bin"
  } = req.body || {};

  try {
    const nb = await findNotebook(bearer, notebookName);
    const recycle = await ensureSection(bearer, nb.id, recycleSectionName);

    // Search pages in the notebook by query; Graph supports ?search=
    // We’ll collect with several calls to catch our prefixes.
    const moved = [];
    const skipped = [];

    const queries = titlePrefixes.map(pfx => `title:"${pfx.replace(/"/g, '\\"')}"`);
    // Fallback broad query to catch “quick log” variants
    queries.push("quick log");

    const uniquePages = new Map();

    for (const q of queries) {
      const url = `https://graph.microsoft.com/v1.0/me/onenote/pages?search=${encodeURIComponent(q)}&$select=id,title,createdDateTime,parentSection`;
      const r = await graphGET(bearer, url);
      if (!r.ok) continue;
      for (const pg of (r.json.value || [])) {
        // Optionally keep only recent pages
        if (createdAfter) {
          const when = new Date(pg.createdDateTime || 0);
          if (when < new Date(createdAfter)) continue;
        }
        // Avoid duplicates across queries
        if (!uniquePages.has(pg.id)) uniquePages.set(pg.id, pg);
      }
    }

    // Move each page by PATCHing parentSection@odata.bind (Graph supports moving OneNote pages)
    for (const pg of uniquePages.values()) {
      try {
        const patch = await graphPATCH(
          bearer,
          `https://graph.microsoft.com/v1.0/me/onenote/pages/${encodeURIComponent(pg.id)}`,
          {
            "parentSection@odata.bind": `https://graph.microsoft.com/v1.0/me/onenote/sections/${encodeURIComponent(recycle.id)}`
          }
        );
        if (!patch.ok) {
          skipped.push({ id: pg.id, title: pg.title, error: patch.json });
        } else {
          moved.push({ id: pg.id, title: pg.title });
        }
      } catch (e) {
        skipped.push({ id: pg.id, title: pg.title, error: String(e) });
      }
    }

    return res.status(200).json({
      ok: true,
      notebookId: nb.id,
      recycleSectionId: recycle.id,
      movedCount: moved.length,
      moved,
      skipped
    });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e.message || e) });
  }
}
