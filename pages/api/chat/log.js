// pages/api/chat/log.js
export default async function handler(req, res) {
  // Minimal CORS (helps if you ever call this from a web UI)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    // Accept text from:
    // - POST JSON: { "text": "..." }
    // - GET query: /api/chat/log?text=...
    let text;
    if (req.method === 'POST') {
      // next.js already parsed body for JSON; fall back if raw
      if (typeof req.body === 'string') {
        try { text = JSON.parse(req.body).text; } catch { /* ignore */ }
      } else if (req.body && typeof req.body === 'object') {
        text = req.body.text;
      }
    } else {
      text = req.query.text;
    }

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ ok: false, error: 'Missing text' });
    }

    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const origin = `${proto}://${host}`;

    // Use your working quick-log route (which handles create/append + tokens)
    const upstream = await fetch(`${origin}/api/onenote/quick-log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // forward cookies so the server-side session is used
        ...(req.headers.cookie ? { cookie: req.headers.cookie } : {}),
      },
      body: JSON.stringify({ text }),
    });

    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok || data?.ok === false) {
      return res
        .status(upstream.status || 500)
        .json({ ok: false, error: 'Append failed', detail: data });
    }

    return res.status(200).json({ ok: true, ...data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
