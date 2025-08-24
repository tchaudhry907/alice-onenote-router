// pages/api/auth/login.js
import crypto from 'crypto';

const AUTH_BASE = 'https://login.microsoftonline.com';

function b64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function sha256(input) {
  return crypto.createHash('sha256').update(input).digest();
}

export default function handler(req, res) {
  // 1) PKCE: create verifier & challenge
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(sha256(verifier));
  const state = b64url(crypto.randomBytes(16));

  // 2) Persist verifier & state in short-lived httpOnly cookies
  const cookieFlags = [
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Max-Age=900' // 15 minutes
  ].join('; ');
  res.setHeader('Set-Cookie', [
    `pkce_verifier=${verifier}; ${cookieFlags}`,
    `oauth_state=${state}; ${cookieFlags}`
  ]);

  // 3) Build authorize URL
  const tenant = process.env.MS_TENANT || 'consumers';
  const params = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID,
    response_type: 'code',
    redirect_uri: process.env.REDIRECT_URI,
    response_mode: 'query',
    scope: [
      'openid',
      'profile',
      'offline_access',
      // OneNote scope (Graph)
      'Notes.ReadWrite.All'
    ].join(' '),
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state
  });

  const authorizeUrl = `${AUTH_BASE}/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;
  res.redirect(authorizeUrl);
}
