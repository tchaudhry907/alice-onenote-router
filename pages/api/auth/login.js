// pages/api/auth/login.js
import crypto from 'crypto';

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function setCookie(res, name, value, { maxAge = 300 } = {}) {
  const cookie = [
    `${name}=${value}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax'
  ].join('; ');
  res.setHeader('Set-Cookie', cookie);
}

export default async function handler(req, res) {
  try {
    const { MS_CLIENT_ID, MS_TENANT, REDIRECT_URI } = process.env;

    if (!MS_CLIENT_ID || !MS_TENANT || !REDIRECT_URI) {
      return res
        .status(500)
        .send('Missing required env vars: MS_CLIENT_ID / MS_TENANT / REDIRECT_URI');
    }

    const verifier = base64url(crypto.randomBytes(32));
    const challenge = base64url(
      crypto.createHash('sha256').update(verifier).digest()
    );
    const state = base64url(crypto.randomBytes(16));

    setCookie(res, 'pkce_verifier', verifier, { maxAge: 600 });
    setCookie(res, 'oauth_state', state, { maxAge: 600 });

    const scope = [
      'openid',
      'profile',
      'offline_access',
      'Notes.ReadWrite.All',
      'User.Read'
    ].join(' ');

    const params = new URLSearchParams({
      client_id: MS_CLIENT_ID,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      response_mode: 'query',
      scope,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state
    });

    const authUrl = `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/authorize?${params.toString()}`;

    res.writeHead(302, { Location: authUrl });
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).send('Auth init error');
  }
}
