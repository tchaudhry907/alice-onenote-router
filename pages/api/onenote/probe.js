// pages/api/onenote/probe.js
import { getGraphToken, isJwt } from '@/lib/auth-token';

export default async function handler(req, res) {
  try {
    const { token, source } = await getGraphToken(req);
    if (!token) {
      return res.status(200).json({ ok: false, error: 'No server token found. Use diagnostics: Seed Server (or Force Microsoft Login).' });
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
      body: body,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
