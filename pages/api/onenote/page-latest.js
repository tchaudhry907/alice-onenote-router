// pages/api/onenote/page-latest.js
// Return metadata for the last created page (saved in KV as alice:lastPageId).

import { requireAuth } from "@/lib/auth";
import { kv } from "@/lib/kv";
import { graphFetch } from "@/lib/msgraph";

export default async function handler(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  try {
    const id = await kv.get("alice:lastPageId");
    if (!id) {
      return res.status(404).json({ ok: false, error: "No last page id found. Create one first." });
    }

    const url = `https://graph.microsoft.com/v1.0/me/onenote/pages/${encodeURIComponent(String(id))}`;
    const r = await graphFetch(auth.accessToken, url);
    const j = await r.json();

    if (!r.ok) {
      return res.status(r.status).json({ ok: false, error: j });
    }

    // Return a concise payload used by the dashboard
    res.status(200).json({
      ok: true,
      id: j.id,
      title: j.title,
      createdDateTime: j.createdDateTime,
      links: j.links, // includes oneNoteWebUrl / oneNoteClientUrl
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
