// pages/api/auth/callback.js

const TOKEN_BASE = 'https://login.microsoftonline.com';

export default async function handler(req, res) {
  try {
    const tenant = process.env.MS_TENANT || 'consumers';
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET || '';
    const redirectUri = process.env.REDIRECT_URI;

    const code = req.query.code;
    if (!code) {
      return res.status(400).send('Missing "code". Start at /api/auth/login');
    }

    const tokenUrl = `${TOKEN_BASE}/${tenant}/oauth2/v2.0/token`;

    const form = new URLSearchParams();
    form.set('client_id', clientId);
    form.set('grant_type', 'authorization_code');
    form.set('code', code);
    form.set('redirect_uri', redirectUri);

    if (clientSecret) {
      // Confidential client: include secret, no PKCE required
      form.set('client_secret', clientSecret);
    } else {
      // Public client with PKCE: need the verifier cookie
      const cookie = (req.headers.cookie || '')
        .split(';')
        .map(c => c.trim())
        .find(c => c.startsWith('pkce_verifier='));
      if (!cookie) {
        return res.status(400).send('Missing PKCE verifier. Start at /api/auth/login');
      }
      const verifier = decodeURIComponent(cookie.split('=')[1]);
      form.set('code_verifier', verifier);

      // Clear the cookie
      res.setHeader('Set-Cookie', 'pkce_verifier=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0');
    }

    const resp = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });

    const tokenJson = await resp.json();

    if (!resp.ok) {
      const msg = tokenJson.error_description || JSON.stringify(tokenJson);
      // show the error on the homepage (soft landing)
      const url = new URL(process.env.APP_BASE_URL);
      url.searchParams.set('error', '1');
      url.searchParams.set('message', msg.substring(0, 900));
      res.writeHead(302, { Location: url.toString() });
      return res.end();
    }

    // Success — keep it simple for now: show a tiny success page.
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`
      <html><body>
        <h2>Signed in ✔</h2>
        <p>Access token received for scopes: <code>${tokenJson.scope || ''}</code></p>
        <p><a href="/">Return to home</a></p>
      </body></html>
    `);
  } catch (e) {
    console.error(e);
    res.status(500).send('Callback failure');
  }
}
