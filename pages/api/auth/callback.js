export default async function handler(req, res) {
  // Read query
  const { code, state } = req.query || {};

  // Pull verifier/state from cookies
  const cookieHeader = req.headers.cookie || '';
  const cookieMap = Object.fromEntries(cookieHeader.split(';').map(c => {
    const i = c.indexOf('=');
    if (i === -1) return [c.trim(),''];
    return [c.slice(0,i).trim(), decodeURIComponent(c.slice(i+1).trim())];
  }));

  const gotState   = cookieMap['oauth_state'];
  const verifier   = cookieMap['pkce_verifier'];

  const clearShort = [
    'pkce_verifier=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    'oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
  ];

  // State checks
  if (!state || !gotState || state !== gotState) {
    res.setHeader('Set-Cookie', clearShort);
    return res.status(400).send('Invalid or missing state. Start at /api/auth/login');
  }
  if (!code) {
    res.setHeader('Set-Cookie', clearShort);
    return res.status(400).send('Missing authorization code.');
  }

  const tenant      = process.env.MS_TENANT;
  const clientId    = process.env.MS_CLIENT_ID;
  const clientSecret= process.env.MS_CLIENT_SECRET; // optional
  const redirectUri = process.env.REDIRECT_URI;

  // Build token request
  const form = new URLSearchParams({
    client_id: clientId,
    scope: ['openid','profile','offline_access','User.Read','Notes.ReadWrite'].join(' '),
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code
  });

  if (clientSecret) {
    form.append('client_secret', clientSecret);
  } else if (verifier) {
    form.append('code_verifier', verifier);
  } else {
    res.setHeader('Set-Cookie', clearShort);
    return res.status(400).send('Missing PKCE verifier. Start at /api/auth/login');
  }

  // Exchange
  const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`;
  const rsp = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type':'application/x-www-form-urlencoded' },
    body: form.toString()
  });

  const text = await rsp.text();
  let payload;
  try { payload = JSON.parse(text); } catch { payload = { raw: text }; }

  if (!rsp.ok) {
    // Clear temp cookies
    res.setHeader('Set-Cookie', clearShort);
    // Surface exact AAD error
    const msg = payload.error_description || text || 'Token exchange failed';
    return res.status(400).send(`Token error:\n${msg}`);
  }

  // ✅ Success: set a thin session marker (we’ll add token storage later)
  const session = { ok: true, at: Date.now() };
  const sessionCookie = `session=${encodeURIComponent(JSON.stringify(session))}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=3600`;

  // Clear temp cookies and set session
  res.setHeader('Set-Cookie', [...clearShort, sessionCookie]);

  // Back to home with a success hint
  const base = process.env.APP_BASE_URL || '/';
  return res.redirect(302, `${base}/?login=success`);
}
