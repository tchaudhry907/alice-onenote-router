// pages/api/auth/callback.js
import crypto from 'crypto';

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return Object.fromEntries(
    header.split(/; */).filter(Boolean).map((c) => {
      const i = c.indexOf('=');
      const k = decodeURIComponent(c.slice(0, i));
      const v = decodeURIComponent(c.slice(i + 1));
      return [k, v];
    })
  );
}

function setCookie(res, name, value, { maxAge = 3600 } = {}) {
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

function clearCookie(res, name) {
  res.setHeader('Set-Cookie', `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
}

export default async function handler(req, res) {
  try {
    const { MS_CLIENT_ID, MS_TENANT, REDIRECT_URI } = process.env;
    if (!MS_CLIENT_ID || !MS_TENANT || !REDIRECT_URI) {
      return res
        .status(500)
        .send('Missing required env vars: MS_CLIENT_ID / MS_TENANT / REDIRECT_URI');
    }

    const { code, state } = req.query || {};
    if (!code) {
      return res.status(400).send('Missing "code". Start at /api/auth/login');
    }

    const cookies = parseCookies(req);
    const verifier = cookies['pkce_verifier'];
    const savedState = cookies['oauth_state'];

    if (!verifier) {
      return res.status(400).send('Missing PKCE verifier. Start at /api/auth/login');
    }
    if (!savedState || savedState !== state) {
      return res.status(400).send('Invalid state. Start at /api/auth/login');
    }

    // Exchange authorization code for tokens
    const tokenUrl = `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      client_id: MS_CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier
    });

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    const tokenJson = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error('Token exchange failed:', tokenJson);
      return res.status(500).send('Token exchange failed');
    }

    // Clean PKCE cookies
    clearCookie(res, 'pkce_verifier');
    clearCookie(res, 'oauth_state');

    // Store access/refresh tokens as short-lived httpOnly cookies (demo only).
    // In a real app, store/rotate them in a server-side session or DB.
    if (tokenJson.access_token) {
      setCookie(res, 'session_access_token', tokenJson.access_token, { maxAge: tokenJson.expires_in || 3600 });
    }
    if (tokenJson.refresh_token) {
      // MS issues refresh tokens for delegated flows when allowed.
      setCookie(res, 'session_refresh_token', tokenJson.refresh_token, { maxAge: 60 * 60 * 24 * 7 });
    }

    // Redirect somewhere friendly—home page works for our quick test
    res.writeHead(302, { Location: '/' });
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).send('Callback error');
  }
}
