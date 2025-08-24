// pages/api/auth/callback.js
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
function clearCookie(res, name) {
  res.setHeader('Set-Cookie', `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None`);
}
function setCookie(res, name, value, { maxAge = 3600 } = {}) {
  const cookie = [
    `${name}=${value}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'Secure',
    'SameSite=None'
  ].join('; ');
  res.setHeader('Set-Cookie', cookie);
}

export default async function handler(req, res) {
  try {
    const { MS_CLIENT_ID, MS_CLIENT_SECRET, MS_TENANT, REDIRECT_URI } = process.env;
    if (!MS_CLIENT_ID || !MS_TENANT || !REDIRECT_URI) {
      return res.status(500).send('Missing required env vars');
    }

    const { code, state } = req.query || {};
    if (!code) return res.status(400).send('Missing "code". Start at /api/auth/login');

    const cookies = parseCookies(req);
    const verifier = cookies['pkce_verifier'];
    const savedState = cookies['oauth_state'];
    if (!verifier) return res.status(400).send('Missing PKCE verifier. Start at /api/auth/login');
    if (!savedState || savedState !== state) return res.status(400).send('Invalid state');

    const tokenUrl = `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/token`;
    const params = {
      client_id: MS_CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier
    };
    if (MS_CLIENT_SECRET) params.client_secret = MS_CLIENT_SECRET;

    const resp = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params)
    });
    const json = await resp.json();
    if (!resp.ok) {
      console.error('Token exchange failed:', json);
      return res
        .status(500)
        .send(`Token exchange failed: ${json.error_description || json.error || 'unknown'}`);
    }

    clearCookie(res, 'pkce_verifier');
    clearCookie(res, 'oauth_state');

    if (json.access_token) {
      setCookie(res, 'session_access_token', json.access_token, { maxAge: json.expires_in || 3600 });
    }
    if (json.refresh_token) {
      setCookie(res, 'session_refresh_token', json.refresh_token, { maxAge: 60 * 60 * 24 * 7 });
    }

    res.writeHead(302, { Location: '/' });
    res.end();
  } catch (e) {
    console.error(e);
    res.status(500).send('Callback error');
  }
}
