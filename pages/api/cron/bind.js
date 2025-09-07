// /pages/api/cron/bind.js
// Called once after login, while your browser session has a valid token.
// Saves the refresh_token into KV (Redis) for headless use later.

import { kv } from "@/lib/kv";
import { getTokenCookie } from "@/lib/cookie";
import { exchangeCodeForRefresh } from "@/lib/msgraph";

export default async function handler(req, res) {
  try {
    const token = getTokenCookie(req);
    if (!token) {
      return res.status(401).json({ ok: false, error: "Not signed in" });
    }

    // Exchange current access token → refresh token
    const { refresh_token } = await exchangeCodeForRefresh(token);
    if (!refresh_token) {
      return res.status(400).json({ ok: false, error: "No refresh_token returned" });
    }

    await kv.set("alice:cron:refresh", refresh_token);
    return res.status(200).json({ ok: true, bound: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
