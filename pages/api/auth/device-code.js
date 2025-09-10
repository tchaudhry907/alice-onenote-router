// pages/api/auth/device-code.js
import { kvSet, kvGet, kvDel } from '../../../lib/kv';

export default async function handler(req, res) {
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  // ...existing code...

  if (req.method === 'POST') {
    const { action } = req.body || {};

    if (action === 'poll') {
      // ... your existing polling logic that exchanges device_code for tokens ...
      // suppose you end up with:
      //   access_token, refresh_token, expires_in (seconds)
      // when it's approved:

      if (approved) {
        const bundle = {
          accessToken: access_token,
          refreshToken: refresh_token || null,
          // store absolute expiry so we can refresh if needed
          expiresAt: Date.now() + (expires_in - 60) * 1000, // skew by 60s
        };
        if (!bearer) {
          return res.status(400).json({ ok: false, error: 'Missing bearer' });
        }
        await kvSet(`msgraph:${bearer}`, bundle, expires_in); // TTL matches token
        return res.status(200).json({ ok: true });
      }

      // still pending
      return res.status(200).json({ ok: false, pending: true });
    }

    // ...reset/begin branches unchanged...
  }

  res.status(405).json({ ok: false, error: 'Method not allowed' });
}
