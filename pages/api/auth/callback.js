// pages/api/auth/callback.js
import cookie from "cookie";

export default async function handler(req, res) {
  const { code } = req.query;

  // Get verifier from cookie
  const cookies = cookie.parse(req.headers.cookie || "");
  const verifier = cookies["pkce_verifier"];

  if (!verifier) {
    return res.status(400).send("Missing PKCE verifier. Start at /api/auth/login");
  }

  const params = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID,
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.APP_BASE_URL + "/api/auth/callback",
    code_verifier: verifier,
    client_secret: process.env.MS_CLIENT_SECRET,
  });

  try {
    const tokenRes = await fetch(`https://login.microsoftonline.com/${process.env.MS_TENANT}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const tokenData = await tokenRes.json();

    // Clear PKCE cookie
    res.setHeader("Set-Cookie", "pkce_verifier=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax");

    if (tokenData.error) {
      return res.status(400).json(tokenData);
    }

    res.json(tokenData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
