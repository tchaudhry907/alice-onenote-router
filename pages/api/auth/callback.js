// pages/api/auth/callback.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  const { code, error } = req.query;
  if (error) {
    return res.status(400).send(`OAuth error: ${error}`);
  }

  const cookies = req.cookies || {};
  const code_verifier = cookies.pkce_verifier;

  if (!code_verifier) {
    return res.status(400).send("Missing PKCE verifier. Start at /api/auth/login");
  }

  try {
    const tokenResponse = await fetch(`https://login.microsoftonline.com/${process.env.MS_TENANT}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.MS_CLIENT_ID,
        client_secret: process.env.MS_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: `${process.env.APP_BASE_URL}/api/auth/callback`,
        code_verifier, // <- use the stored verifier
      }),
    });

    const token = await tokenResponse.json();

    if (token.error) {
      return res.status(400).json(token);
    }

    // Store token JSON in session cookie
    res.setHeader("Set-Cookie", `session=${JSON.stringify(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=3600`);

    return res.redirect("/login-success");
  } catch (err) {
    console.error("Callback exchange failed:", err);
    return res.status(500).send("Token exchange failed");
  }
}
