import cookie from "cookie";

/**
 * Refresh Microsoft OAuth tokens using the refresh_token cookie.
 * - Reads refresh_token from cookies
 * - Calls MS v2 token endpoint
 * - Rewrites access_token / refresh_token / id_token cookies
 * - Returns a small JSON payload for the diagnostics UI
 *
 * Required env:
 *   MS_CLIENT_ID
 *   MS_CLIENT_SECRET
 *   MS_TENANT               (e.g. "common" or "consumers")
 *   APP_BASE_URL            (e.g. "https://alice-onenote-router.vercel.app")
 * Optional:
 *   REDIRECT_URI            (defaults to `${APP_BASE_URL}/api/auth/callback`)
 *   MS_SCOPES               (defaults to a safe, wide set incl. offline_access)
 */
export default async function handler(req, res) {
  try {
    // Parse cookies
    const cookies = cookie.parse(req.headers.cookie || "");
    const existingRefresh = cookies.refresh_token;

    if (!existingRefresh) {
      return res
        .status(400)
        .json({ ok: false, error: "No refresh_token cookie" });
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

    // Build x-www-form-urlencoded body
    const form = new URLSearchParams();
    form.set("client_id", CLIENT_ID);
    form.set("client_secret", CLIENT_SECRET);
    form.set("grant_type", "refresh_token");
    form.set("refresh_token", existingRefresh);
    form.set("redirect_uri", REDIRECT_URI);
    // Including scope on refresh keeps the token shape consistent
    form.set("scope", SCOPES);

    const resp = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });

    const data = await resp.json();

    if (!resp.ok) {
      // Surface MS error for easier debugging
      return res.status(400).json({
        ok: false,
        error: data.error || "refresh_failed",
        error_description: data.error_description,
      });
    }

    const {
      access_token,
      refresh_token,
      id_token,
      expires_in, // seconds
      token_type,
      scope,
    } = data;

    if (!access_token || !refresh_token) {
      return res.status(400).json({
        ok: false,
        error: "Missing tokens in refresh response",
        raw: data,
      });
    }

    // Set/rotate cookies
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
        // give it plenty of time; MS refresh tokens are long-lived but rolling
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

    return res.status(200).json({
      ok: true,
      token_type,
      scope,
      expires_in,
      // don’t echo tokens back; they’re in cookies now
      message: "Tokens refreshed and cookies updated",
    });
  } catch (err) {
    console.error("auth/refresh error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "server_error", details: err.message });
  }
}
