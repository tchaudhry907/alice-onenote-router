// pages/api/onenote/quick-log.js

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ ok: false, error: 'Missing Bearer token' });
  const token = auth.slice('Bearer '.length).trim();
  const expected = process.env.ACTION_BEARER_TOKEN;
  if (!expected) return res.status(500).json({ ok: false, error: 'Server misconfig: ACTION_BEARER_TOKEN not set' });
  if (token !== expected) return res.status(401).json({ ok: false, error: 'Invalid token' });

  const { text } = req.body || {};
  if (typeof text !== 'string' || !text) {
    return res.status(400).json({ ok: false, error: 'Invalid body: { text } is required' });
  }

  // TODO: append to Daily Log; stub for now:
  return res.status(200).json({ ok: true });
}
