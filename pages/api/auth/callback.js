import { parse, serialize } from 'cookie';
import CryptoJS from 'crypto-js';
import fetch from 'node-fetch';

const MS_TOKEN = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';

export default async function handler(req, res) {
  try {
    const { code } = req.query;
    const cookies = parse(req.headers.cookie || '');
    const verifier = cookies.pkce_verifier;

    if (!code || !verifier) {
      return res.status(400).send('Missing "code" or PKCE verifier.');
    }

    const params = new URLSearchParams({
      client_id: process.env.MS_CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.REDIRECT_URI,
      code_verifier: verifier
    });

    const tokenResp = await fetch(MS_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });

    const tokens = await tokenResp.json();
    if (!tokenResp.ok) {
      return res.status(400).json(tokens);
    }

    // Encrypt refresh token; store as httpOnly cookie
    const cipher = CryptoJS.AES.encrypt(tokens.refresh_token, process.env.ENCRYPTION_SECRET).toString();
    const rtCookie = serialize('rt', cipher, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: 60 * 60 * 24 * 180 // ~6 months
    });

    // Clear PKCE cookie
    const clearPkce = serialize('pkce_verifier', '', { path: '/', maxAge: 0 });

    res.setHeader('Set-Cookie', [rtCookie, clearPkce]);
    res.status(200).send('Authentication complete. You can close this tab.');
  } catch (e) {
    res.status(500).send(`Callback error: ${e?.message || e}`);
  }
}
