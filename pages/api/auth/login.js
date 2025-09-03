export default function handler(req, res) {
  const tenant = process.env.MS_TENANT || "common";
  const auth = new URL(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`);
  auth.searchParams.set("client_id", process.env.MS_CLIENT_ID);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("redirect_uri", process.env.REDIRECT_URI);
  auth.searchParams.set("response_mode", "query");
  auth.searchParams.set("scope", process.env.MS_SCOPES || "openid profile User.Read");

  // (Optional) add state/nonce later
  res.writeHead(302, { Location: auth.toString() }).end();
}
