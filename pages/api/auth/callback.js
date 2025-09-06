// pages/api/auth/callback.js
import { kv } from "@/lib/kv";
import { setTokenCookie } from "@/lib/cookie";

export default async function handler(req, res) {
  try {
    const { APP_BASE_URL, MS_TENANT, MS_CLIENT_ID, MS_CLIENT_SECRET, REDIRECT_URI } = process.env;
    const code = req.query.code;
    const state = typeof req.query.state === "string" ? req.query.state : "/";

    if (!code) return res.status(400).json({ ok: false, error: "Missing code" });

    const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(
      MS_TENANT
    )}/oauth2/v2.0/token`;

    const body = new URLSearchParams({
      client_id: MS_CLIENT_ID,
      client_secret: MS_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI || `${APP_BASE_URL}/api/auth/callback`,
    });

    const tr = await fetch(tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });

    const tokens = await tr.json();
    if (!tr.ok) {
      return res.status(tr.status).json({ ok: false, error: "Token exchange failed", detail: tokens });
    }

    const refreshToken = tokens.refresh_token;
    if (!refreshToken) return res.status(400).json({ ok: false, error: "No refresh_token in response" });

    const cookieKey = setTokenCookie(res);
    await kv.set(cookieKey, refreshToken, { ex: 60 * 60 * 24 * 30 });

    res.redirect(state.startsWith("/") ? state : "/");
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
