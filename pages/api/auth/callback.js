const TENANT = process.env.MS_TENANT || "consumers";
const CLIENT_ID = process.env.MS_CLIENT_ID;
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const TOKEN_URL = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`;

function getCookie(req, name) {
  const m = (req.headers.cookie || "").match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function kill(name) {
  return `${name}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;
}
function set(name, value, opts = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "Secure",
    "HttpOnly",
    "SameSite=Lax"
  ];
  if (opts.maxAge) parts.push(`Max-Age=${opts.maxAge}`);
  return parts.join("; ");
}

export default async function handler(req, res) {
  try {
    if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
      return res.status(500).send("Missing required environment variables.");
    }

    const { code, state } = req.query || {};
    if (!code || !state) {
      return res.status(400).send('Missing "code" or "state". Start at /api/auth/login');
    }

    const expectedState = getCookie(req, "state");
    if (!expectedState || expectedState !== state) {
      // clear any old state to avoid loops
      res.setHeader("Set-Cookie", [kill("state")]);
      return res
        .status(400)
        .send('Invalid or missing state. Clear cookies at /api/debug/clear-cookies then start at /api/auth/login');
    }

    // Exchange code -> tokens using client_secret (no PKCE)
    const body = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      scope: "openid profile offline_access Notes.ReadWrite.All"
    });

    const r = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });

    const tokenJson = await r.json();

    if (!r.ok) {
      const msg =
        tokenJson?.error_description ||
        tokenJson?.error ||
        `Token endpoint HTTP ${r.status}`;
      // clear state regardless
      res.setHeader("Set-Cookie", [kill("state")]);
      return res.status(400).send(`Token error: ${msg}`);
    }

    // Basic session for now: store tokens in httpOnly cookies (debug only)
    const cookies = [
      kill("state"),
      set("session_ok", "1", { maxAge: 60 * 60 }), // 1h
      set("access_token", tokenJson.access_token, { maxAge: tokenJson.expires_in || 3600 })
    ];
    if (tokenJson.refresh_token) {
      cookies.push(set("refresh_token", tokenJson.refresh_token, { maxAge: 60 * 60 * 24 * 14 }));
    }
    res.setHeader("Set-Cookie", cookies);

    // You already have /login-success.js — send users there
    return res.redirect(302, "/login-success");
  } catch (e) {
    return res.status(500).send(`Callback failure\n\n${e?.stack || e}`);
  }
}
