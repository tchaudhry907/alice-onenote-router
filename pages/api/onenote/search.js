// pages/api/onenote/search.js
// Search pages within a section using OneNote $search.
// GET params: sectionId (required), q (required)

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

    if (!section) {
      return res.status(400).json({ ok: false, error: "Missing sectionId" });
    }
    if (!query) {
      return res.status(400).json({ ok: false, error: "Missing q" });
    }

    const data = await graphFetch(
      "GET",
      `/me/onenote/sections/${encodeURIComponent(section)}/pages?$search=${encodeURIComponent(q)}`
    );

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}

// Note: exchangeRefreshToken is imported only for compatibility.
// This endpoint does not attempt re-auth automatically.
