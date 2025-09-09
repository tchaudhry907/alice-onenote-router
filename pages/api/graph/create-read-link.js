// pages/api/graph/create-read-link.js

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*'); // tighten to your origin if you want
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  // 🔑 Bearer auth (stop using cookies/sessions here)
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'Missing Bearer token' });
  }
  const token = auth.slice('Bearer '.length).trim();
  const expected = process.env.ACTION_BEARER_TOKEN;
  if (!expected) return res.status(500).json({ ok: false, error: 'Server misconfig: ACTION_BEARER_TOKEN not set' });
  if (token !== expected) return res.status(401).json({ ok: false, error: 'Invalid token' });

  // ✅ Validate input
  const { title, html } = req.body || {};
  if (typeof title !== 'string' || typeof html !== 'string' || !title || !html) {
    return res.status(400).json({ ok: false, error: 'Invalid body: { title, html } are required strings' });
  }

  // === YOUR REAL ONENOTE LOGIC GOES HERE ===
  // 1) Create page in Notebook=AliceChatGPT, Section=Inbox (hardcoded in your code)
  // 2) Read back first lines -> text
  // 3) Build links { oneNoteWebUrl, oneNoteClientUrl }

  // Stub response to prove auth path works; replace with real result.
  const createdId = 'mock-' + Math.random().toString(36).slice(2, 10);
  const text = 'First lines from created page…';
  const links = {
    oneNoteWebUrl: `https://example.com/onenote/${createdId}`,
    oneNoteClientUrl: `onenote:https://example.com/onenote/${createdId}`
  };

  return res.status(200).json({ ok: true, created: { id: createdId }, text, links });
}
