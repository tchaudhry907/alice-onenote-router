// pages/api/probe.js
// Shows whether we have a refresh token and whether we can mint an access token.

import { kv } from "@/lib/kv";
import { getAccessToken } from "@/lib/msgraph";

export default async function handler(req, res) {
  try {
    const tokenRecord = (await kv.get("ms:token")) || {};
    let canAccess = false;
    try {
      const t = await getAccessToken();
      canAccess = Boolean(t && t.length > 30);
    } catch {}

    return res.status(200).json({
      ok: true,
      has_refresh: Boolean(tokenRecord.refresh_token),
      expires_at: tokenRecord.expires_at || null,
      can_get_access_token: canAccess,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
