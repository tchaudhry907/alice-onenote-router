// pages/api/auth/login.js
import crypto from 'crypto';

const AUTH_BASE = 'https://login.microsoftonline.com';

function b64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export default async function handler(req, res) {
  try {
    const tenant = process.env.MS_TENANT || 'consumers';
    const clientId = process.env.MS_CLIENT_ID;
    const redirectUri = process.env.REDIRECT_URI;
    const haveSecret = !!process.env.MS_CLIENT_SECRET;

    if (!clientId || !redirectUri) {
      res.status(500).send('Missing MS_CLIENT_ID or REDIRECT_URI');
      return;
    }

    // Common scopes for Graph + offline access
    const scopes = [
      'openid', 'profile', 'email',
      'offline_access',
      // OneNote + basic Graph user info
      'Notes.ReadWrite.All',
      'User.Read'
    ].join(' ');

    const authorize = new URL(`${AUTH_BASE}/${tenant}/oauth2/v2.0/authorize`);
    authorize.searchParams.set('client_id', clientId);
    authorize.searchParams.set('response_type', 'code');
    authorize.searchParams.set('redirect_uri', redirectUri);
    authorize.searchParams.set('response_mode', 'query');
    authorize.searchParams.set('scope', scopes);
    // Let user pick account each time (helps while testing)
    authorize.searchParams.set('prompt', 'select_account');

    if (!haveSecret) {
      // Public client (PKCE)
      const verifier = b64url(crypto.randomBytes(32));
      const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());

      // Short‑lived, httpOnly cookie with the verifier
      res.setHeader('Set-Cookie', [
        `pkce_verifier=${verifier}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=600`
      ]);

      authorize.searchParams.set('code_challenge_method', 'S256');
      authorize.searchParams.set('code_challenge', challenge);
    }

    res.writeHead(302, { Location: authorize.toString() });
    res.end();
  } catch (e) {
    console.error(e);
    res.status(500).send('Login endpoint error');
  }
}
