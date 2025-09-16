// pages/api/graph/me.js
import { graphGET } from "@/lib/auth";

export default async function handler(req, res) {
  try {
    const me = await graphGET(req, "/me");
    return res.status(200).json(me);
  } catch (err) {
    const msg = err?.message || String(err);
    return res.status(err?.status || 500).json({ ok: false, error: msg });
  }
}
