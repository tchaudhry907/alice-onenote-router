// pages/api/cleanup.js
// Utility endpoint to clear common KV keys/queues (uses YOUR KV wrapper).
// WARNING: This deletes data. Keep it protected in production.

import { kv } from "@/lib/kv";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  try {
    const body = req.body && typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
    const doQueues = !!body.queues;
    const doTokens = !!body.tokens;

    const deleted = [];

    if (doQueues) {
      const keys = ["queue:v1"];
      for (const k of keys) {
        await kv.del(k);
        deleted.push(k);
      }
    }

    if (doTokens) {
      const keys = ["ms:access_token", "graph:access_token", "access_token", "ms:token"];
      for (const k of keys) {
        await kv.del(k);
        deleted.push(k);
      }
    }

    return res.status(200).json({ ok: true, deleted });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
