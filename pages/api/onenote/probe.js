// pages/api/onenote/probe.js
// Uses server-seeded tokens from KV to call Graph /me (no header paste needed)

import { kvGet } from '@/lib/kv';

async function graphFetch(path, token) {
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, statusText: res.statusText, text };
}

export default async function handler(req, res) {
  try {
    const candidateKeys = ['ms:access_token','graph:access_token','access_token'];
    let token = null;
    for (const k of candidateKeys) {
      const v = await kvGet(k);
      if (typeof v === 'string' && v.includes('.')) { token = v; break; }
    }
    if (!token) {
      return res.status(400).json({
        ok: false,
        error: 'No server token found in KV. Hit /api/onenote/seed with your Authorization header.',
        triedKeys: candidateKeys
      });
    }

    const me = await graphFetch('/me', token);
    const bodySnippet = me.text.length > 500 ? me.text.slice(0, 500) + '…' : me.text;

    return res.status(200).json({
      ok: me.ok,
      status: me.status,
      statusText: me.statusText,
      bodySnippet
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
