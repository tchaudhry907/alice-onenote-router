// pages/api/debug/tokens.js
import { kvGet } from "@/lib/kv";

export default async function handler(req, res) {
  try {
    const keys = [
      "graph:access_token",
      "ms:access_token",
      "access_token",
      "ms:refresh_token",
    ];
    const out = {};
    for (const k of keys) out[k] = await kvGet(k);
    res.status(200).json(out);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
