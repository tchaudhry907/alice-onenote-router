// lib/auth.js
// Glue between cookie, KV and Graph.

import { kv } from "@/lib/kv";
import { getTokenKeyFromReq } from "@/lib/cookie";
import { exchangeRefreshToken } from "@/lib/msgraph";

export async function requireAuth(req, res) {
  const key = getTokenKeyFromReq(req);
  if (!key) {
    res.status(401).json({ ok: false, error: "not authenticated" });
    return null;
  }
  const refreshToken = await kv.get(key);
  if (!refreshToken) {
    res.status(401).json({ ok: false, error: "session expired" });
    return null;
  }
  const tokenResp = await exchangeRefreshToken(refreshToken);
  const accessToken = tokenResp.access_token;
  return { key, refreshToken, accessToken };
}
