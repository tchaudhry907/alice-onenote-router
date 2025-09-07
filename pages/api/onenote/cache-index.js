// /pages/api/onenote/cache-index.js
import { getAccessToken } from '@/lib/auth';
import { saveNotebookIndex } from '@/lib/indexer';

export default async function handler(req, res) {
  try {
    const token = await getAccessToken(req, res);
    if (!token) return res.status(401).json({ ok: false, error: 'Not authenticated' });

    const resp = await fetch(
      'https://graph.microsoft.com/v1.0/me/onenote/notebooks?$expand=sections',
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!resp.ok) {
      const body = await resp.text();
      return res.status(resp.status).json({ ok: false, error: 'Graph error', detail: body });
    }

    const data = await resp.json();
    await saveNotebookIndex(data); // <— store in Redis with TTL

    res.json({ ok: true, count: Array.isArray(data?.value) ? data.value.length : 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
