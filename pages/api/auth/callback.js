// pages/api/auth/callback.js
import cookie from "cookie";

/**
 * Handles the redirect back from Microsoft.
 * Exchanges the authorization code for tokens and stores them in cookies.
 *
 * Env needed:
 *   MS_CLIENT_ID
 *   MS_CLIENT_SECRET
 *   MS_TENANT
 *   APP_BASE_URL
 *   MS_SCOPES (optional)
 *   REDIRECT_URI (optional)   defaults to `${APP_BASE_URL}/api/auth/callback`
 */
export default async function handler(req, res) {
  try {
    const { code, error, error_description } = req.query || {};

    if (error) {
      return res
        .status(400)
        .json({ ok: false, error, error_description: error_description || "" });
    }
    if (!code) {
      return res.status(400).json({ ok: false, error: "Missing code" });
    }

    const TENANT = process.env.MS_TENANT || "common";
    const CLIENT_ID = process.env.MS_CLIENT_ID;
    const CLIENT_SECRET = process.env.MS_CLIENT_SECRET;
    const APP_BASE_URL = process.env.APP_BASE_URL;
    const REDIRECT_URI =
      process.env.REDIRECT_URI || `${APP_BASE_URL}/api/auth/callback`;
    const SCOPES =
      process.env.MS_SCOPES ||
      "offline_access openid profile User.Read Notes.ReadWrite.All";

    if (!CLIENT_ID || !CLIENT_SECRET || !APP_BASE_URL) {
      return res.status(500).json({
        ok: false,
        error:
          "Missing required env (MS_CLIENT_ID / MS_CLIENT_SECRET / APP_BASE_URL)",
      });
    }

    const tokenEndpoint = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`;

    const form = new URLSearchParams();
    form.set("client_id", CLIENT_ID);
    form.set("client_secret", CLIENT_SECRET);
    form.set("grant_type", "authorization_code");
    form.set("code", code);
    form.set("redirect_uri", REDIRECT_URI);
    form.set("scope", SCOPES);

    const resp = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });

    const data = await resp.json();

    if (!resp.ok) {
      // Show MS error plainly so we can diagnose
      return res.status(400).json({
        ok: false,
        error: data.error || "token_exchange_failed",
        error_description: data.error_description,
      });
    }

    const {
      access_token,
      refresh_token,
      id_token,
      expires_in, // seconds
    } = data;

    if (!access_token || !refresh_token) {
      return res.status(400).json({
        ok: false,
        error: "Missing tokens in callback exchange",
        raw: data,
      });
    }

    const setCookies = [
      cookie.serialize("access_token", access_token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: typeof expires_in === "number" ? expires_in : 3600,
      }),
      cookie.serialize("refresh_token", refresh_token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      }),
      cookie.serialize("id_token", id_token || "", {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24,
      }),
    ];

    res.setHeader("Set-Cookie", setCookies);

    // Bounce back to diagnostics so you can see "Tokens present"
    res.writeHead(302, { Location: `${APP_BASE_URL}/debug/diagnostics` });
    res.end();
  } catch (e) {
    console.error("auth/callback error:", e);
    res.status(500).json({ ok: false, error: "server_error", details: e.message });
  }
}
