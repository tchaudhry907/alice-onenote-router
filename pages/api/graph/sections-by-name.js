// pages/api/graph/sections-by-name.js
// Finds a OneNote section by section name *and* parent notebook name,
// then normalizes the section id to the true GUID by fetching the section detail.
//
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

    // 1) List all sections with parentNotebook to filter by names
    const listUrl = new URL("https://graph.microsoft.com/v1.0/me/onenote/sections");
    listUrl.searchParams.set("$top", "200");
    listUrl.searchParams.set("$select", "id,displayName");
    listUrl.searchParams.set("$expand", "parentNotebook($select=id,displayName)");

    const listResp = await fetch(listUrl.toString(), {
      headers: { Authorization: `Bearer ${decodeURIComponent(token)}` },
    });
    const listJson = await listResp.json();
    if (!listResp.ok) return res.status(listResp.status).json(listJson);

    const candidate = (listJson.value || []).find(s =>
      (s.displayName || "").toLowerCase() === section.toLowerCase() &&
      (s.parentNotebook?.displayName || "").toLowerCase() === notebook.toLowerCase()
    );
    if (!candidate) {
      return res.status(404).json({ error: "Section not found", notebook, section });
    }

    // 2) Normalize: fetch the section detail by id — this returns the GUID form for consumer accounts
    const detailUrl = `https://graph.microsoft.com/v1.0/me/onenote/sections/${encodeURIComponent(candidate.id)}?$select=id,displayName`;
    const detailResp = await fetch(detailUrl, {
      headers: { Authorization: `Bearer ${decodeURIComponent(token)}` },
    });
    const detailJson = await detailResp.json();
    if (!detailResp.ok) return res.status(detailResp.status).json(detailJson);

    // Some tenants return GUID directly, others still return composite here.
    // If it still looks composite, we will also attempt to extract GUID from any client link later.
    const idGuid = detailJson.id;

    return res.status(200).json({
      section: {
        idGuid, // intended to be the true GUID
        displayName: detailJson.displayName || candidate.displayName,
        parentNotebook: {
          id: candidate.parentNotebook?.id || null,
          displayName: candidate.parentNotebook?.displayName || null,
        },
      },
    });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
