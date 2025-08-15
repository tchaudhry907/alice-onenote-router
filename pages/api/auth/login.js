// pages/api/auth/login.js
import crypto from 'node:crypto';

// Use the tenant from env (consumers | common | organizations | tenant ID)
const TENANT = process.env.MS_TENANT || 'consumers';
const AUTH_BASE = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize`;

function toB64Url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export default function handler(req, res) {
  // PKCE verifier + challenge
  const verifierBytes = crypto.randomBytes(32);
  const verifier = toB64Url(verifierBytes);
  const challenge = toB64Url(crypto.createHash('sha256').update(verifier).digest());

  // 5‑minute httpOnly cookie to hold the verifier
  res.setHeader('Set-Cookie', [
    `pkce_verifier=${verifier}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=300`
  ]);

  const params = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID,
    response_type: 'code',
    redirect_uri: process.env.REDIRECT_URI,
    response_mode: 'query',
    scope: [
      'openid',
      'profile',
      'offline_access',
      'User.Read',
      'Notes.ReadWrite.All'
    ].join(' '),
    code_challenge: challenge,
    code_challenge_method: 'S256'
  });

  res.redirect(`${AUTH_BASE}?${params.toString()}`);
}
