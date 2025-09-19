// pages/api/onenote/search.js
import { graphFetch, exchangeRefreshToken } from "@/lib/msgraph";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }
  try {
    const sectionId = String(req.query.sectionId || "").trim();
    const q = String(req.query.q || "").trim();
    if (!sectionId) return res.status(400).json({ ok: false, error: "Missing sectionId" });

    const suffix = q ? `?search=${encodeURIComponent(q)}` : "";
    const data = await graphFetch("GET", `/me/onenote/sections/${encodeURIComponent(sectionId)}/pages${suffix}`);
    return res.status(200).json({ ok: true, data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
