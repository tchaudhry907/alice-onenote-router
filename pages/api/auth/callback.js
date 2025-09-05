// pages/api/auth/callback.js
import { setCookie } from "cookies-next";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "Use GET" });
    }

    const {
      MS_TENANT = "common",
      MS_CLIENT_ID,
      MS_CLIENT_SECRET,
      MS_REDIRECT_URI = "https://alice-onenote-router.vercel.app/api/auth/callback",
    } = process.env;

    const code = req.query.code;
    if (!code) {
      return res.status(400).json({ ok: false, error: "Missing authorization code" });
    }
    if (!MS_CLIENT_ID || !MS_CLIENT_SECRET) {
      return res.status(500).json({ ok: false, error: "Client credentials not configured" });
    }

    const tokenUrl = `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/token`;

    const form = new URLSearchParams({
      client_id: MS_CLIENT_ID,
      client_secret: MS_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: MS_REDIRECT_URI,
    });

    // Use the same scopes as the /login route
    form.append(
      "scope",
      [
        "offline_access",
        "openid",
        "profile",
        "User.Read",
        "Notes.ReadWrite",
        "Notes.Create",
        "Files.ReadWrite.All",
      ].join(" ")
    );

    const r = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });

    const body = await r.json();

    if (!r.ok) {
      // Surface Microsoft’s real message to the browser so we can fix quickly.
      return res
        .status(400)
        .json({ ok: false, error: "Token exchange failed", details: body });
    }

    const { access_token, refresh_token, id_token, expires_in } = body;

    // Basic session cookies (refresh_token is what we need server-side)
    // If you browse with Safari, cross-site cookies can be blocked—so keep SameSite=Lax.
    const cookieOpts = {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    };

    if (access_token) {
      setCookie("ms_access_token", access_token, {
        ...cookieOpts,
        maxAge: Math.max(1, Number(expires_in || 3600) - 60),
      });
    }
    if (refresh_token) {
      setCookie("ms_refresh_token", refresh_token, {
        ...cookieOpts,
        // 90 days typical for MS; safe shorter default:
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    if (id_token) {
      setCookie("ms_id_token", id_token, { ...cookieOpts, maxAge: 60 * 60 * 24 * 7 });
    }

    // Send you back to the test page
    return res.redirect(302, "/test");
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
