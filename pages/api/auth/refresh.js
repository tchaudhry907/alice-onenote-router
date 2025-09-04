// pages/api/auth/refresh.js
export default async function handler(req, res) {
  try {
    const refresh = req.cookies?.refresh_token;
    if (!refresh) {
      return res.status(401).json({ ok: false, error: "No refresh_token cookie" });
    }

    // TODO: set these in your Vercel env if not already
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    // Use your app's tenant if you prefer; "common" works for MSA/Work/School
    const tokenUrl = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

    if (!clientId || !clientSecret) {
      return res.status(500).json({ ok: false, error: "Missing MS_CLIENT_ID / MS_CLIENT_SECRET" });
    }

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refresh,
      // MS Graph default scopes; adjust if your app uses different scopes
      scope: "https://graph.microsoft.com/.default offline_access",
    });

    const r = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const data = await r.json();
    if (!r.ok || !data.access_token) {
      return res
        .status(r.status || 500)
        .json({ ok: false, error: data.error_description || "Failed to refresh access token" });
    }

    // Set HttpOnly cookie with the new access token
    const maxAge = Math.max(1, parseInt(data.expires_in || "300", 10)); // seconds
    res.setHeader("Set-Cookie", [
      `access_token=${data.access_token}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${maxAge}`,
    ]);

    return res.status(200).json({ ok: true, expires_in: maxAge });
  } catch (err) {
    console.error("refresh error", err);
    return res.status(500).json({ ok: false, error: "Exception refreshing access token" });
  }
}
