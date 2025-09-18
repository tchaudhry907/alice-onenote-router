// pages/api/log/quick.js
// Tiny GET wrapper around POST /api/log so you can trigger logging via a simple link.
// Usage: GET /api/log/quick?text=walked%2012345%20steps

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  const { text } = req.query;
  if (!text || String(text).trim().length === 0) {
    return res.status(400).json({ ok: false, error: 'Missing ?text=...' });
  }

  // Build absolute URL back to our own /api/log
  const proto = (req.headers['x-forwarded-proto'] || 'https');
  const host = req.headers.host;
  const url = `${proto}://${host}/api/log`;

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Pass through the text exactly as the POST handler expects
      body: JSON.stringify({ text }),
      cache: 'no-store',
    });

    const data = await r.json().catch(() => ({}));
    return res.status(r.status).json(data);
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || 'Internal Error' });
  }
}
