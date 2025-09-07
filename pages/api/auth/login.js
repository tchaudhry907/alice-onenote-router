// pages/api/auth/login.js
/**
 * Starts Microsoft OAuth (v2) using the Authorization Code flow.
 * Redirects the browser to the /authorize URL with response_type=code.
 *
 * Env needed:
 *   MS_CLIENT_ID
 *   MS_TENANT                 e.g. "common" or "consumers"
 *   APP_BASE_URL              e.g. "https://alice-onenote-router.vercel.app"
 *   MS_SCOPES (optional)      default includes offline_access for refresh
 */
export default async function handler(req, res) {
  const TENANT = process.env.MS_TENANT || "common";
  const CLIENT_ID = process.env.MS_CLIENT_ID;
  const APP_BASE_URL = process.env.APP_BASE_URL;

  if (!CLIENT_ID || !APP_BASE_URL) {
    return res
      .status(500)
      .json({ ok: false, error: "Missing MS_CLIENT_ID or APP_BASE_URL" });
  }

  const REDIRECT_URI =
    process.env.REDIRECT_URI || `${APP_BASE_URL}/api/auth/callback`;

  const SCOPES =
    process.env.MS_SCOPES ||
    "offline_access openid profile User.Read Notes.ReadWrite.All";

  // Minimal state/nonce; for simplicity we leave them static here.
  // If you want CSRF protection, generate and store state in a cookie.
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    response_mode: "query",
    scope: SCOPES,
    prompt: "select_account", // guarantees an interactive prompt if needed
  });

  const authorizeUrl = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize?${params.toString()}`;

  res.writeHead(302, { Location: authorizeUrl });
  res.end();
}
