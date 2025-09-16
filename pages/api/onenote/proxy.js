// /pages/api/onenote/proxy.js
import { getBearerFromReq, graphGET } from "@/lib/graph";

export default async function handler(req, res) {
  try {
    const bearer = getBearerFromReq(req);
    if (!bearer) return res.status(401).json({ ok: false, error: "No access token" });

    // Example: /api/onenote/proxy?path=/me/onenote/notebooks
    const path = req.query.path;
    if (!path || typeof path !== "string" || !path.startsWith("/")) {
      return res.status(400).json({ ok: false, error: "Provide ?path=/me/onenote/…" });
    }

    const url = `https://graph.microsoft.com/v1.0${path}`;
    const data = await graphGET(url, bearer);
    return res.status(200).json({ ok: true, data });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e.message || e) });
  }
}
