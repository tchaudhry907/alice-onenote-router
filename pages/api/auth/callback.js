// /pages/api/auth/callback.js
//
// Full, copy-paste replacement.
// Exchanges the auth code for tokens, sets cookies that Diagnostics expects,
// and then returns you to /debug/diagnostics.

import { serialize } from "cookie";

const TENANT = process.env.MS_TENANT || "common"; // you've set this already
const CLIENT_ID = process.env.MS_CLIENT_ID;
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET;
const REDIRECT_URI = process.env.APP_BASE_URL?.replace(/\/+$/, "") + "/api/auth/callback";
const TOKEN_URL = `https://login.microsoftonline.com/${encodeURIComponent(TENANT)}/oauth2/v2.0/token`;

function setCookie(name, value, opts = {}) {
  // Sensible, secure defaults for server cookies on Vercel
  return serialize(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    ...opts,
  });
}

export default async function handler(req, res) {
  try {
    // Only GET is used because MS sends the "code" on the query string
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const { code, state, error, error_description } = req.query || {};

    if (error) {
      // MS could bounce back with error in query
      return res
        .status(400)
        .json({ ok: false, stage: "auth-callback", error, error_description });
    }

    if (!code) {
      return res
        .status(400)
        .json({ ok: false, stage: "auth-callback", error: "Missing authorization code" });
    }

    // Exchange authorization code for tokens
    const body = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      scope:
        process.env.MS_SCOPES ||
        "offline_access openid profile User.Read Files.ReadWrite.All Notes.ReadWrite.All",
    });

    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const json = await tokenRes.json().catch(() => ({}));

    if (!tokenRes.ok) {
      // Bubble up Graph/AAD error for quick diagnosis in Diagnostics
      return res.status(tokenRes.status).json({
        ok: false,
        stage: "token-exchange",
        error: json.error || "token_request_failed",
        error_description: json.error_description || JSON.stringify(json),
      });
    }

    // We should have tokens now
    const {
      access_token = "",
      refresh_token = "",
      id_token = "",
      expires_in = 3600,
      token_type = "Bearer",
      scope = "",
    } = json;

    // Prepare a compact session blob (handy in other API routes)
    const session = {
      token_type,
      scope,
      access_token,
      refresh_token,
      id_token,
      // When it expires (epoch seconds)
      expires_at: Math.floor(Date.now() / 1000) + Number(expires_in || 3600),
      // Optional: echo state for debugging
      state: typeof state === "string" ? state : undefined,
    };

    // Set cookies that your Diagnostics page already knows how to read:
    // - refresh_token, access_token, id_token (individual)
    // - alice_session (JSON bundle)
    res.setHeader("Set-Cookie", [
      setCookie("refresh_token", refresh_token || ""),
      setCookie("access_token", access_token || ""),
      setCookie("id_token", id_token || ""),
      setCookie("alice_session", encodeURIComponent(JSON.stringify(session))),
    ]);

    // After setting cookies, take user back to the Diagnostics page
    // (you can change this to wherever you prefer)
    return res.redirect(302, "/debug/diagnostics");
  } catch (err) {
    // Never leak errors silently
    return res.status(500).json({
      ok: false,
      stage: "callback-unhandled",
      error: String(err && err.message ? err.message : err),
    });
  }
}
