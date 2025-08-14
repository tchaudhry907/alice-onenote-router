import crypto from 'node:crypto';

const MS_AUTH = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize';

export default async function handler(req, res) {
  // Generate PKCE verifier & challenge
  const verifier = toBase64Url(crypto.randomBytes(32).toString('base64'));
  const challenge = toBase64Url(
    crypto.createHash('sha256').update(verifier).digest('base64')
  );

  // Store the verifier in a short-lived, httpOnly cookie (5 min)
  res.setHeader('Set-Cookie', [
    `pkce_verifier=${verifier}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=300`
  ]);

  const params = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID,
    response_type: 'code',
    redirect_uri: process.env.REDIRECT_URI,
    response_mode: 'query',
    scope: [
      'openid',
      'offline_access',
      'profile',
      'Notes.ReadWrite.All'
    ].join(' '),
    code_challenge: challenge,
    code_challenge_method: 'S256'
  });

  res.redirect(`${MS_AUTH}?${params.toString()}`);
}

function toBase64Url(b64) {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/,'');
}
