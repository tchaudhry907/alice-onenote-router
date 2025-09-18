// pages/api/cron/health.js
import { kv } from "@/lib/kv";

export default async function handler(req, res) {
  try {
    const token = await kv.get("ms:access_token");
    res.status(200).json({ ok: true, kv: "reachable", hasToken: !!token });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
