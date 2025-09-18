// pages/api/onenote/probe.js
// Self-contained probe: reads token (KV/header/cookie) and calls Graph /me.

import { getGraphToken } from '@/lib/auth-token';

function isJwt(t) {
  return !!t && /^eyJ/.test(t) && (t.split('.').length >= 3);
}

export default async function handler(req, res) {
  try {
    const { token, source } = await getGraphToken(req);
    if (!token) {
      return res.status(200).json({
        ok: false,
        error: 'No server token found. Open /debug/diagnostics → Force Microsoft Login or Seed.',
      });
    }

    const r = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    const text = await r.text();
    let body; try { body = JSON.parse(text); } catch { body = { raw: text } }

    return res.status(200).json({
      ok: r.ok,
      status: r.status,
      statusText: r.statusText,
      source,
      tokenLooksJwt: isJwt(token),
      body,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
