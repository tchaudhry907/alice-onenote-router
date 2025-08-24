// pages/api/auth/callback.js
const {
  MS_CLIENT_ID,
  MS_CLIENT_SECRET,
  MS_TENANT_ID,
  APP_BASE_URL,
} = process.env;

function readCookie(req, name) {
  const raw = req.headers.cookie || "";
  return raw
    .split(/; */)
    .map(c => c.split("="))
    .reduce((acc, [k, ...v]) => {
      if (!k) return acc;
      const key = decodeURIComponent(k.trim());
      const val = decodeURIComponent((v.join("=") || "").trim());
      acc[key] = val;
      return acc;
    }, {})[name];
}

function cookieStr(name, value, opts = {}) {
  const {
    httpOnly = true,
    secure = true,
    sameSite = "Lax",
    path = "/",
    maxAge,
  } = opts;
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (maxAge) parts.push(`Max-Age=${maxAge}`);
  if (path) parts.push(`Path=${path}`);
  if (sameSite) parts.push(`SameSite=${sameSite}`);
  if (secure) parts.push("Secure");
  if (httpOnly) parts.push("HttpOnly");
  return parts.join("; ");
}

export default async function handler(req, res) {
  const { code, state, error, error_description } = req.query || {};

  try {
    if (error) {
      // surface auth error
      return res
        .status(400)
        .send(`Auth error: ${error}; ${error_description || ""}`);
    }

    if (!code) {
      return res
        .status(400)
        .send('Missing "code". Start at /login to initiate sign-in.');
    }

    // Validate state
    const expectedState = readCookie(req, "oauth_state");
    if (!state || !expectedState || state !== expectedState) {
      return res.status(400).send("State mismatch. Start at /login.");
    }

    // PKCE verifier (we will include it, and ALSO include client_secret)
    const code_verifier = readCookie(req, "pkce_verifier");
    if (!code_verifier) {
      return res.status(400).send("Missing PKCE verifier. Start at /login.");
    }

    if (!MS_CLIENT_ID || !MS_TENANT_ID || !APP_BASE_URL || !MS_CLIENT_SECRET) {
      return res.status(500).send("Server missing required env vars.");
    }

    // Exchange code for tokens
    const tokenUrl = `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      client_id: MS_CLIENT_ID,
      client_secret: MS_CLIENT_SECRET,           // <-- always include
      grant_type: "authorization_code",
      code,
      redirect_uri: `${APP_BASE_URL}/api/auth/callback`,
      code_verifier,                             // <-- include PKCE too
    });

    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const tokenJson = await tokenRes.json();

    if (!tokenRes.ok) {
      const msg =
        tokenJson.error_description ||
        JSON.stringify(tokenJson, null, 2) ||
        "Token exchange failed";
      return res.status(400).send(`Token error: ${msg}`);
    }

    // Persist tokens in secure cookies
    const {
      access_token,
      refresh_token,
      expires_in = 3600,
    } = tokenJson;

    // Access token (~1 hour)
    // Refresh token (longer; we'll use 30 days here)
    res.setHeader("Set-Cookie", [
      cookieStr("access_token", access_token, {
        maxAge: Math.max(1, Number(expires_in)),
      }),
      cookieStr("refresh_token", refresh_token || "", {
        maxAge: 60 * 60 * 24 * 30,
      }),
      cookieStr("session", "true", { maxAge: 60 * 60 * 24 * 7 }),
      // clear short-lived setup cookies
      cookieStr("pkce_verifier", "", { maxAge: 0 }),
      cookieStr("oauth_state", "", { maxAge: 0 }),
    ]);

    // Back to home with success flag
    return res.redirect(302, "/?login=success");
  } catch (err) {
    console.error("callback error:", err);
    return res.status(500).send("Callback failed.");
  }
}
