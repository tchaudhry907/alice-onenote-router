// pages/api/debug/test-graph.js
import { getBearerFromReq, graphGET } from "@/lib/auth";

export default async function handler(req, res) {
  try {
    const bearer = getBearerFromReq(req);
    if (!bearer) return res.status(401).json({ ok: false, error: "No access token" });

    const me = await graphGET("https://graph.microsoft.com/v1.0/me", bearer);
    return res.status(200).json(me);
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e.message || e) });
  }
}
