// pages/api/auth/force-graph-token.js
import { ensureGraphAccessToken } from "@/lib/graph";

export default async function handler(req, res) {
  try {
    const out = await ensureGraphAccessToken(req, res);
    res.status(200).json({ ok: true, message: "Graph access token ensured", meta: out.info });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e.message || e) });
  }
}
