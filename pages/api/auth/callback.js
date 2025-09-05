// pages/api/auth/callback.js
function serializeCookie(name, value, { maxAge, path = "/", httpOnly = true, secure = true, sameSite = "lax" } = {}) {
  const enc = encodeURIComponent;
  let cookie = `${name}=${enc(value)}`;
  if (maxAge) cookie += `; Max-Age=${Math.floor(maxAge)}`;
  if (path) cookie += `; Path=${path}`;
  if (httpOnly) cookie += `; HttpOnly`;
  if (secure) cookie += `; Secure`;
  if (sameSite) cookie += `; SameSite=${sameSite}`;
  return cookie;
}

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
    if (!code) return res.status(400).json({ ok: false, error: "Missing authorization code" });
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
      scope: [
        "offline_access",
        "openid",
        "profile",
        "User.Read",
        "Notes.ReadWrite",
        "Notes.Create",
        "Files.ReadWrite.All",
      ].join(" "),
    });

    const resp = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });

    const body = await resp.json();

    if (!resp.ok) {
      return res.status(400).json({ ok: false, error: "Token exchange failed", details: body });
    }

    const { access_token, refresh_token, id_token, expires_in } = body;

    const cookies = [];
    if (access_token) {
      cookies.push(
        serializeCookie("ms_access_token", access_token, { maxAge: Math.max(1, (Number(expires_in) || 3600) - 60) })
      );
    }
    if (refresh_token) {
      // default ~30 days
      cookies.push(serializeCookie("ms_refresh_token", refresh_token, { maxAge: 60 * 60 * 24 * 30 }));
    }
    if (id_token) {
      cookies.push(serializeCookie("ms_id_token", id_token, { maxAge: 60 * 60 * 24 * 7 }));
    }
    if (cookies.length) res.setHeader("Set-Cookie", cookies);

    // back to the test dashboard
    res.writeHead(302, { Location: "/test" });
    res.end();
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
