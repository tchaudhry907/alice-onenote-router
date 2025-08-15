// pages/api/auth/callback.js
import { parse, serialize } from 'cookie';
import CryptoJS from 'crypto-js';

const TENANT = process.env.MS_TENANT || 'consumers';
const TOKEN_URL = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`;

export default async function handler(req, res) {
  try {
    const { code, error, error_description } = req.query || {};
    if (error) {
      res.status(400).send(`<pre>OAuth error: ${error}\n${error_description || ''}</pre>`);
      return;
    }
    if (!code) {
      res.status(400).send('Missing "code". Start at /api/auth/login');
      return;
    }

    const cookies = parse(req.headers.cookie || '');
    const verifier = cookies.pkce_verifier;
    if (!verifier) {
      res.status(400).send('Missing PKCE verifier. Start at /api/auth/login');
      return;
    }

    // Exchange code for tokens (PKCE)
    const form = new URLSearchParams({
      client_id: process.env.MS_CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.REDIRECT_URI,
      code_verifier: verifier
    });

    const r = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form
    });

    const tokens = await r.json();
    if (!r.ok) {
      res.status(400).send(`<pre>Token error:\n${JSON.stringify(tokens, null, 2)}</pre>`);
      return;
    }

    // Encrypt and store refresh token in httpOnly cookie (6 months)
    const cipher = CryptoJS.AES.encrypt(tokens.refresh_token, process.env.ENCRYPTION_SECRET).toString();
    const rtCookie = serialize('rt', cipher, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: 60 * 60 * 24 * 180
    });

    // Clear pkce cookie
    const clearPkce = serialize('pkce_verifier', '', { path: '/', maxAge: 0 });

    res.setHeader('Set-Cookie', [rtCookie, clearPkce]);
    res.status(200).send('Authentication complete. You can close this tab.');
  } catch (e) {
    res.status(500).send(`<pre>Callback error:\n${e?.message || String(e)}</pre>`);
  }
}
