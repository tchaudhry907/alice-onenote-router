// pages/api/auth/callback.js

const TOKEN_BASE = 'https://login.microsoftonline.com';

export default async function handler(req, res) {
  try {
    const tenant = process.env.MS_TENANT || 'consumers';
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    const redirectUri = process.env.REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return res.status(500).send('Missing MS_CLIENT_ID, MS_CLIENT_SECRET, or REDIRECT_URI');
    }

    const code = req.query.code;
    if (!code) {
      return res.status(400).send('Missing "code". Start at /api/auth/login');
    }

    const tokenUrl = `${TOKEN_BASE}/${tenant}/oauth2/v2.0/token`;

    const form = new URLSearchParams();
    form.set('client_id', clientId);
    form.set('client_secret', clientSecret);
    form.set('grant_type', 'authorization_code');
    form.set('code', code);
    form.set('redirect_uri', redirectUri);

    const resp = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });

    const tokenJson = await resp.json();

    if (!resp.ok) {
      const msg = tokenJson.error_description || JSON.stringify(tokenJson);
      // Send you back to home with a readable error
      const url = new URL(process.env.APP_BASE_URL);
      url.searchParams.set('error', '1');
      url.searchParams.set('message', msg.substring(0, 900));
      res.writeHead(302, { Location: url.toString() });
      return res.end();
    }

    // Minimal success page for now
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`
      <html><body>
        <h2>Signed in ✔</h2>
        <p>Scopes: <code>${tokenJson.scope || ''}</code></p>
        <p><a href="/">Return to home</a></p>
      </body></html>
    `);
  } catch (e) {
    console.error(e);
    res.status(500).send('Callback failure');
  }
}
