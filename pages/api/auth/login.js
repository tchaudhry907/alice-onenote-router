// pages/api/auth/login.js

const AUTH_BASE = 'https://login.microsoftonline.com';

export default async function handler(req, res) {
  try {
    const tenant = process.env.MS_TENANT || 'consumers';
    const clientId = process.env.MS_CLIENT_ID;
    const redirectUri = process.env.REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return res.status(500).send('Missing MS_CLIENT_ID or REDIRECT_URI');
    }

    // Scopes for OneNote + basic Graph info
    const scopes = [
      'openid', 'profile', 'email',
      'offline_access',
      'Notes.ReadWrite.All',
      'User.Read'
    ].join(' ');

    const authorize = new URL(`${AUTH_BASE}/${tenant}/oauth2/v2.0/authorize`);
    authorize.searchParams.set('client_id', clientId);
    authorize.searchParams.set('response_type', 'code');
    authorize.searchParams.set('redirect_uri', redirectUri);
    authorize.searchParams.set('response_mode', 'query');
    authorize.searchParams.set('scope', scopes);
    authorize.searchParams.set('prompt', 'select_account');

    res.writeHead(302, { Location: authorize.toString() });
    res.end();
  } catch (e) {
    console.error(e);
    res.status(500).send('Login endpoint error');
  }
}
