import crypto from 'crypto';

// base64url helpers
const b64u = buf => Buffer.from(buf).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const sha256 = str => crypto.createHash('sha256').update(str).digest();

export default async function handler(req, res) {
  // REQUIRE vars (fail fast with explicit message)
  const required = ['APP_BASE_URL','REDIRECT_URI','MS_CLIENT_ID','MS_TENANT','ENCRYPTION_SECRET'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) {
    return res.status(500).send(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Prepare PKCE + state
  const verifier = b64u(crypto.randomBytes(32));
  const challenge = b64u(sha256(verifier));
  const state = b64u(crypto.randomBytes(24));

  const cookieFlags = 'Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=300'; // 5 min

  // Set cookies for callback verification
  res.setHeader('Set-Cookie', [
    `pkce_verifier=${verifier}; ${cookieFlags}`,
    `oauth_state=${state}; ${cookieFlags}`
  ]);

  // Build authorize URL
  const tenant = process.env.MS_TENANT;              // e.g. 'consumers'
  const clientId = process.env.MS_CLIENT_ID;
  const redirectUri = process.env.REDIRECT_URI;

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: [
      'openid','profile','offline_access',
      'User.Read',        // baseline
      'Notes.ReadWrite'   // OneNote scope
    ].join(' '),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state
  });

  const url = `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize?${params.toString()}`;
  return res.redirect(302, url);
}
