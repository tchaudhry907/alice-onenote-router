// pages/api/graph/me.js
import { graphFetch } from "@/lib/auth";

export default async function handler(req, res) {
  try {
    const r = await graphFetch(req, "/me", { method: "GET" });
    const text = await r.text();
    if (!r.ok) return res.status(r.status).json({ ok: false, error: text });
    return res.status(200).send(text); // pass through Graph JSON
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err.message || err) });
  }
}
