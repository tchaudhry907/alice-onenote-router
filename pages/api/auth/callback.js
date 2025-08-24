// pages/api/auth/callback.js

export default async function handler(req, res) {
  const { code, state, error, error_description } = req.query;

  if (error) {
    return res
      .status(400)
      .send(`OAuth error: ${error}${error_description ? " - " + error_description : ""}`);
  }

  const cookies = req.cookies || {};
  const code_verifier = cookies.pkce_verifier;
  const state_cookie = cookies.oauth_state;

  if (!code) return res.status(400).send("Missing 'code' from Microsoft.");
  if (!code_verifier) return res.status(400).send('Missing PKCE verifier. Start at /api/auth/login');
  if (!state || state !== state_cookie)
    return res.status(400).send('Invalid or missing state. Start at /api/auth/login');

  try {
    const body = new URLSearchParams({
      client_id: process.env.MS_CLIENT_ID,
      client_secret: process.env.MS_CLIENT_SECRET ?? "",
      grant_type: "authorization_code",
      code,
      redirect_uri: `${process.env.APP_BASE_URL}/api/auth/callback`,
      code_verifier, // must be *exactly* what we set in login.js
    });

    const resp = await fetch(
      `https://login.microsoftonline.com/${process.env.MS_TENANT}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      }
    );

    const token = await resp.json();
    if (token.error) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(400).send(JSON.stringify(token, null, 2));
    }

    const cookieFlags = "Path=/; HttpOnly; Secure; SameSite=Lax";
    res.setHeader("Set-Cookie", [
      `session=${JSON.stringify(token)}; ${cookieFlags}; Max-Age=3600`,
      `pkce_verifier=; ${cookieFlags}; Max-Age=0`,
      `oauth_state=; ${cookieFlags}; Max-Age=0`,
      `flow=; ${cookieFlags}; Max-Age=0`,
    ]);

    res.redirect("/login-success");
  } catch (e) {
    console.error("Token exchange failed:", e);
    res.status(500).send("Token exchange failed");
  }
}
