// pages/api/auth/login.js
// Redirect user to Microsoft Login (Auth Code Flow)

export default async function handler(req, res) {
  const tenant = process.env.MS_TENANT_ID || process.env.AZURE_TENANT_ID || "common";
  const clientId = process.env.MS_CLIENT_ID || process.env.AZURE_CLIENT_ID;
  const redirect =
    process.env.MS_REDIRECT_URI ||
    `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}/api/auth/callback`;

  if (!clientId) {
    res.status(500).json({ ok: false, error: "Missing MS_CLIENT_ID" });
    return;
  }

  const scope = encodeURIComponent("openid offline_access profile https://graph.microsoft.com/.default");
  const authUrl =
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&response_type=code&redirect_uri=${encodeURIComponent(redirect)}` +
    `&response_mode=query&scope=${scope}`;

  res.writeHead(302, { Location: authUrl });
  res.end();
}
