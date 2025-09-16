// pages/api/graph/me.js
import { getBearerFromReq, graphGET } from "@/lib/auth";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  try {
    const token = getBearerFromReq(req);
    if (!token) {
      return res.status(401).json({ ok: false, error: "Missing access token (send Authorization: Bearer …)" });
    }
    const me = await graphGET(token, "/me");
    return res.status(200).json(me);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = err?.status || 500;
    return res.status(code).json({ ok: false, error: msg });
  }
}
