// pages/api/onenote/search.js
// Search pages within a section using OneNote $search.
// GET params: sectionId (required), q (required)
//
// Example: /api/onenote/search?sectionId=...&q=Food:2025-09

import { graphFetch, exchangeRefreshToken } from "@/lib/msgraph";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  try {
    const { sectionId = "", q = "" } = req.query || {};
    const section = String(sectionId).trim();
    const query = String(q).trim();

    if (!section) return res.status(400).json({ ok: false, error: "Missing sectionId" });
    if (!query) return res.status(400).json({ ok: false, error: "Missing q" });

    const data = await graphFetch(
      "GET",
      `/me/onenote/sections/${encodeURIComponent(section)}/pages?$search=${encodeURIComponent(query)}`,
      null,
      {}
    );

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    // If callers ever decide to force a re-auth, they can hit a different endpoint.
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}

// Optional helper route (disabled by default):
// If you ever want to expose a re-auth attempt via this endpoint, you could
// wire a conditional that calls `await exchangeRefreshToken(...)` here.
// For now, we only import it to satisfy legacy imports without changing behavior.
