// /pages/api/auth/login.js
//
// Full, copy-paste replacement.
// Sends the browser to the Microsoft authorize endpoint to start OAuth.
//
// Requires env:
//   - MS_TENANT
//   - MS_CLIENT_ID
//   - APP_BASE_URL

export default async function handler(req, res) {
  const tenant = process.env.MS_TENANT || "common";
  const clientId = process.env.MS_CLIENT_ID;

  const base =
    (process.env.APP_BASE_URL || "").replace(/\/+$/, "") ||
    "https://alice-onenote-router.vercel.app";

  const redirectUri = `${base}/api/auth/callback`;

  // Optional place to go AFTER our callback finishes (purely for UX)
  const returnTo = (req.query?.return || "/debug/diagnostics").toString();

  // Scopes: use your env if provided, otherwise a sane default set
  const scope =
    process.env.MS_SCOPES ||
    "offline_access openid profile User.Read Files.ReadWrite.All Notes.ReadWrite.All";

  // Encode the 'returnTo' inside state so the callback could use it later if desired
  const state = Buffer.from(
    JSON.stringify({ returnTo })
  ).toString("base64url");

  const authUrl =
    `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_mode=query` +
    `&scope=${encodeURIComponent(scope)}` +
    `&prompt=select_account` +
    `&state=${encodeURIComponent(state)}`;

  return res.redirect(302, authUrl);
}
