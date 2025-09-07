// /pages/api/cron/bind.js
// One-time (or occasional) bind: must be signed in in the same browser.
// Copies your current Microsoft refresh token into KV so server jobs can run headlessly.

import { kv } from "@/lib/kv";
import { requireAuth } from "@/lib/auth";

export default async function handler(req, res) {
  try {
    // Ensure you're signed in; your existing auth should return tokens
    const auth = await requireAuth(req, res);
    if (!auth) {
      // requireAuth should have already sent a 401/redirect; just stop here.
      return;
    }

    const refreshToken = auth.refreshToken || auth.refresh_token;
    if (!refreshToken) {
      return res
        .status(400)
        .json({ ok: false, error: "No refresh token found on session" });
    }

    // Save for ~90 days; you can re-bind any time to refresh the TTL
    await kv.set("alice:cron:refresh", refreshToken, { ex: 60 * 60 * 24 * 90 });

    return res.status(200).json({ ok: true, bound: true });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, error: String(e?.message || e) });
  }
}
