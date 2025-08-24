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
    const { MS_CLIENT_ID, MS_CLIENT_SECRET, MS_TENANT, REDIRECT_URI } = process.env;
    if (!MS_CLIENT_ID || !MS_TENANT || !REDIRECT_URI) {
      return res
        .status(500)
        .send('Missing required env vars: MS_CLIENT_ID / MS_TENANT / REDIRECT_URI');
    }

    const { code, state } = req.query || {};
    if (!code) return res.status(400).send('Missing "code". Start at /api/auth/login');

    const cookies = parseCookies(req);
    const verifier = cookies['pkce_verifier'];
    const savedState = cookies['oauth_state'];
    if (!verifier) return res.status(400).send('Missing PKCE verifier. Start at /api/auth/login');
    if (!savedState || savedState !== state) return res.status(400).send('Invalid state.');

    // Build token exchange payload
    const tokenUrl = `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/token`;
    const params = {
      client_id: MS_CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier
    };
    // For confidential "Web" apps Azure expects a client_secret:
    if (MS_CLIENT_SECRET) params.client_secret = MS_CLIENT_SECRET;

    const body = new URLSearchParams(params);
    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    const tokenJson = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error('Token exchange failed:', tokenJson);
      return res.status(500).send(`Token exchange failed: ${tokenJson.error_description || tokenJson.error || 'unknown'}`);
    }

    // Clean PKCE cookies
    clearCookie(res, 'pkce_verifier');
    clearCookie(res, 'oauth_state');

    // Demo session cookies (short-lived). In production, store server-side.
    if (tokenJson.access_token) {
      setCookie(res, 'session_access_token', tokenJson.access_token, { maxAge: tokenJson.expires_in || 3600 });
    }
    if (tokenJson.refresh_token) {
      setCookie(res, 'session_refresh_token', tokenJson.refresh_token, { maxAge: 60 * 60 * 24 * 7 });
    }

    res.writeHead(302, { Location: '/' });
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).send('Callback error');
  }
}
