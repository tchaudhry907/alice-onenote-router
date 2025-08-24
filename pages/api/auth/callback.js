export default async function handler(req, res) {
  const code = req.query.code;
  const cookies = req.headers.cookie || "";
  const verifierMatch = cookies.match(/pkce_verifier=([^;]+)/);
  const verifier = verifierMatch ? verifierMatch[1] : null;

  if (!code || !verifier) {
    return res.status(400).send("Missing code or PKCE verifier. Start at /api/auth/login");
  }

  const params = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID,
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.REDIRECT_URI,
    code_verifier: verifier,
  });

  const resp = await fetch(`https://login.microsoftonline.com/${process.env.MS_TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await resp.json();
  res.status(resp.ok ? 200 : 400).json(data);
}
