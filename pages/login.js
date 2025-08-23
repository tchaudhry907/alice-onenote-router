// pages/api/auth/login.js
import crypto from 'crypto';

// Helpers
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
    // Lax allows cookies on top-level cross-site navigations back to your site.
    'SameSite=Lax'
  ].join('; ');
  res.setHeader('Set-Cookie', cookie);
}

export default async function handler(req, res) {
  try {
    const {
      MS_CLIENT_ID,
      MS_TENANT,
      REDIRECT_URI
    } = process.env;

    if (!MS_CLIENT_ID || !MS_TENANT || !REDIRECT_URI) {
      return res
        .status(500)
        .send('Missing required env vars: MS_CLIENT_ID / MS_TENANT / REDIRECT_URI');
    }

    // PKCE verifier & challenge
    const verifier = base64url(crypto.randomBytes(32));
    const challenge = base64url(
      crypto.createHash('sha256').update(verifier).digest()
    );

    // CSRF state
    const state = base64url(crypto.randomBytes(16));

    // Store both verifier and state in short-lived, httpOnly cookies
    setCookie(res, 'pkce_verifier', verifier, { maxAge: 600 });
    setCookie(res, 'oauth_state', state, { maxAge: 600 });

    const scope = [
      'openid',
      'profile',
      'offline_access',
      // Graph scopes you need during sign-in (delegated):
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

    // For personal accounts use "consumers" (you’ve set MS_TENANT=consumers)
    const authUrl = `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/authorize?${params.toString()}`;

    res.writeHead(302, { Location: authUrl });
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).send('Auth init error');
  }
}
