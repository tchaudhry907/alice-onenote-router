// pages/api/auth/callback.js
export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error) {
      return res.status(400).send(`Auth error: ${error}`);
    }
    if (!code) {
      return res
        .status(400)
        .send('Missing "code" in query. Start at /api/auth/login');
    }

    // Read the PKCE verifier we set during /login
    const cookies = (req.headers.cookie || "").split(";").reduce((acc, pair) => {
      const [k, v] = pair.trim().split("=");
      if (k) acc[k] = decodeURIComponent(v || "");
      return acc;
    }, {});
    const verifier = cookies["pkce_verifier"];
    if (!verifier) {
      return res
        .status(400)
        .send("Missing PKCE verifier. Start at /api/auth/login");
    }

    // Exchange authorization code for tokens
    const tenant = process.env.MS_TENANT || "common";
    const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;

    const form = new URLSearchParams({
      client_id: process.env.MS_CLIENT_ID,
      client_secret: process.env.MS_CLIENT_SECRET, // REQUIRED for Web apps
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.REDIRECT_URI,
      code_verifier: verifier,
    });

    const tokenResp = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });

    const tokenJson = await tokenResp.json();
    if (!tokenResp.ok) {
      const msg = tokenJson?.error_description || JSON.stringify(tokenJson);
      return res.status(400).send(`Token error\n\n${msg}`);
    }

    // Clear the PKCE cookie after use
    res.setHeader(
      "Set-Cookie",
      "pkce_verifier=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0"
    );

    // For now, just dump what we got (so we can verify success).
    // Later you’ll store tokens or continue your app flow.
    res.setHeader("Content-Type", "application/json");
    return res.status(200).send(JSON.stringify(tokenJson, null, 2));
  } catch (e) {
    return res.status(500).send(`Callback failure\n\n${e?.stack || e}`);
  }
}
