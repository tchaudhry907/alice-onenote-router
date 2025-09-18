// /pages/api/cron/drain.js
// Drains KV queue and posts to OneNote via lib/msgraph.v6.js
// - Safe to retry (dedupeKey)
// - Optional auth: set CRON_SECRET in env; if present, requires Authorization: Bearer <secret>

import crypto from "crypto";
import { kv } from "@/lib/kv";
import { graphClient } from "@/lib/msgraph.v6";

function stableHash(obj) {
  const json = typeof obj === "string" ? obj : JSON.stringify(obj);
  return crypto.createHash("sha256").update(json).digest("hex").slice(0, 16);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  // Optional auth
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const hdr = req.headers.authorization || "";
    const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : "";
    if (token !== secret) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
  }

  const processed = [];
  const skipped = [];
  const errors = [];

  try {
    const len = await kv.llen("queue:v1");
    if (!len) {
      return res.status(200).json({ ok: true, drained: 0, processed, skipped, errors });
    }

    const items = [];
    for (let i = 0; i < len; i++) {
      const raw = await kv.rpop("queue:v1");
      if (raw) items.push(JSON.parse(raw));
    }

    const seen = new Set();
    for (const item of items) {
      const payload = item?.payload;
      if (!payload) {
        skipped.push({ reason: "no-payload" });
        continue;
      }
      if (!payload.dedupeKey) payload.dedupeKey = stableHash(payload);
      if (seen.has(payload.dedupeKey)) {
        skipped.push({ dedupeKey: payload.dedupeKey, reason: "duplicate-in-batch" });
        continue;
      }
      seen.add(payload.dedupeKey);

      try {
        const result = await graphClient.postPayload(payload);
        processed.push({
          dedupeKey: payload.dedupeKey,
          pageKey: payload.appendTo?.pageKey || null,
          result,
        });
      } catch (err) {
        // Requeue on error so we don't lose entries
        await kv.lpush("queue:v1", JSON.stringify(item));
        if (err?.status === 401 || err?.status === 403) {
          // Token/auth issues → surface reauth hint but stop draining
          return res.status(200).json({
            ok: false,
            drained: processed.length,
            processed,
            skipped,
            errors: [...errors, { message: "Re-auth needed", code: err.status }],
          });
        }
        errors.push({ message: String(err?.message || err) });
      }
    }

    return res.status(200).json({
      ok: true,
      drained: items.length,
      processed,
      skipped,
      errors,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
