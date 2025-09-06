// pages/api/auth/login.js
export default async function handler(req, res) {
  const {
    APP_BASE_URL,
    MS_TENANT,
    MS_CLIENT_ID,
    REDIRECT_URI,
    MS_SCOPES = "offline_access openid profile User.Read Notes.ReadWrite",
  } = process.env;

  const state = typeof req.query.state === "string" ? req.query.state : "/";

  const authUrl = new URL(
    `https://login.microsoftonline.com/${encodeURIComponent(
      MS_TENANT
    )}/oauth2/v2.0/authorize`
  );
  authUrl.searchParams.set("client_id", MS_CLIENT_ID);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI || `${APP_BASE_URL}/api/auth/callback`);
  authUrl.searchParams.set("response_mode", "query");
  authUrl.searchParams.set("scope", MS_SCOPES);
  authUrl.searchParams.set("state", state);

  res.redirect(authUrl.toString());
}
