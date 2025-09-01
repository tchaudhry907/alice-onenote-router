// pages/api/graph/sections-by-name.js
// Finds a OneNote section by section name *and* parent notebook name.
// Usage:
//   /api/graph/sections-by-name?notebook=AliceChatGPT&section=Inbox
// Returns:
//   { section: { idGuid, displayName, parentNotebook: { id, displayName } } }

export default async function handler(req, res) {
  try {
    const token = req.cookies?.access_token;
    if (!token) return res.status(401).json({ error: "No access_token cookie" });

    const notebook = String(req.query.notebook || "").trim();
    const section  = String(req.query.section  || "").trim();
    if (!notebook || !section) {
      return res.status(400).json({ error: "Missing ?notebook=...&section=..." });
    }

    // Ask Graph for *all* sections with this displayName (across notebooks),
    // and expand parentNotebook so we can filter to the right notebook.
    const url = new URL("https://graph.microsoft.com/v1.0/me/onenote/sections");
    // Filter by section name (case-insensitive matching we'll do client-side)
    url.searchParams.set("$top", "200");
    url.searchParams.set("$select", "id,displayName");
    url.searchParams.set("$expand", "parentNotebook($select=id,displayName)");

    const r = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${decodeURIComponent(token)}` },
    });
    const j = await r.json();
    if (!r.ok) return res.status(r.status).json(j);

    // Normalize and find exact notebook+section match
    const sec = (j.value || []).find(s =>
      (s.displayName || "").toLowerCase() === section.toLowerCase() &&
      (s.parentNotebook?.displayName || "").toLowerCase() === notebook.toLowerCase()
    );

    if (!sec) {
      return res.status(404).json({ error: "Section not found", notebook, section });
    }

    // IMPORTANT: For consumer accounts, this id is a GUID expected by OneNote create header.
    return res.status(200).json({
      section: {
        idGuid: sec.id, // GUID form for section id
        displayName: sec.displayName,
        parentNotebook: {
          id: sec.parentNotebook?.id || null,
          displayName: sec.parentNotebook?.displayName || null,
        },
      },
    });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
