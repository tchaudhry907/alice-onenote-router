// pages/api/auth/login.js
import crypto from 'crypto';

function randomString(len = 43) {
  return crypto.randomBytes(64).toString('base64url').slice(0, len);
}

function setCookie(res, name, value, { maxAge = 600 } = {}) {
  const cookie = [
    `${name}=${value}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'Secure',
    // Use None to be extra tolerant of cross-site redirects from Microsoft
    'SameSite=None'
  ].join('; ');
  res.setHeader('Set-Cookie', cookie);
}

export default async function handler(req, res) {
  const { MS_CLIENT_ID, MS_TENANT, REDIRECT_URI } = process.env;
  if (!MS_CLIENT_ID || !MS_TENANT || !REDIRECT_URI) {
    return res.status(500).send('Missing required env vars');
  }

  // PKCE
  const verifier = randomString(64);
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');

  // CSRF state
  const state = randomString(32);

  // Set short‑lived cookies for verifier & state
  setCookie(res, 'pkce_verifier', verifier, { maxAge: 600 });
  setCookie(res, 'oauth_state', state, { maxAge: 600 });

  const params = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    response_mode: 'query',
    scope: [
      'openid',
      'profile',
      'offline_access',
      'User.Read',
      'Notes.Create',
      'Notes.ReadWrite.All'
    ].join(' '),
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state
  });

  const authUrl = `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/authorize?${params}`;
  res.writeHead(302, { Location: authUrl });
  res.end();
}
