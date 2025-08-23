// pages/api/me.js
function parseCookies(req) {
  const header = req.headers.cookie || '';
  return Object.fromEntries(
    header.split(/; */).filter(Boolean).map((c) => {
      const i = c.indexOf('=');
      const k = decodeURIComponent(c.slice(0, i));
      const v = decodeURIComponent(c.slice(i + 1));
      return [k, v];
    })
  );
}

export default async function handler(req, res) {
  try {
    const cookies = parseCookies(req);
    const token = cookies['session_access_token'];
    if (!token) return res.status(401).json({ error: 'No session access token' });

    const graphRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const json = await graphRes.json();

    if (!graphRes.ok) {
      return res.status(500).json({ error: 'Graph call failed', details: json });
    }

    res.status(200).json(json);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'me endpoint error' });
  }
}
