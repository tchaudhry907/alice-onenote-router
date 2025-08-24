// pages/api/auth/callback.js
export default async function handler(req, res) {
  try {
    const { code, state } = req.query;

    // Guard: must arrive from /api/auth/login
    if (!code) {
      return res.status(400).send('Missing "code" or PKCE verifier. Start at /api/auth/login');
    }

    const cookies = Object.fromEntries(
      (req.headers.cookie || '')
        .split(';')
        .map(v => v.trim())
        .filter(Boolean)
        .map(kv => {
          const idx = kv.indexOf('=');
          return [kv.slice(0, idx), decodeURIComponent(kv.slice(idx + 1))];
        })
    );

    const savedState = cookies['oauth_state'];
    const verifier = cookies['pkce_verifier'];
    if (!verifier) {
      return res.status(400).send('Missing PKCE verifier. Start at /api/auth/login');
    }
    if (!savedState || savedState !== state) {
      return res.status(400).send('State mismatch. Start at /api/auth/login');
    }

    // Exchange code for tokens (no client_secret, this is PKCE)
    const tenant = process.env.MS_TENANT || 'consumers';
    const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.MS_CLIENT_ID,
      code,
      redirect_uri: process.env.REDIRECT_URI,
      code_verifier: verifier
      // No 'scope' here; scopes were requested at authorize time
      // No 'client_secret' for PKCE public client
    });

    const resp = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });

    const json = await resp.json();
    if (!resp.ok) {
      // Surface Microsoft error for quick debugging
      return res
        .status(400)
        .send(`Token error\n\n${JSON.stringify(json, null, 2)}`);
    }

    // Optional: set a simple session cookie with the access token (demo only)
    const cookieFlags = [
      'Path=/',
      'HttpOnly',
      'Secure',
      'SameSite=Lax',
      'Max-Age=3600'
    ].join('; ');
    res.setHeader('Set-Cookie', `ms_access_token=${encodeURIComponent(json.access_token)}; ${cookieFlags}`);

    // Clean up PKCE cookies
    res.setHeader('Set-Cookie', [
      'pkce_verifier=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax',
      'oauth_state=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax'
    ]);

    // Redirect to a simple success page (or your app)
    res.redirect('/login?status=ok');
  } catch (err) {
    res.status(500).send(`Callback crash: ${String(err)}`);
  }
}
