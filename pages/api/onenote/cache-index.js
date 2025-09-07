import { getAccessToken } from '@/lib/auth';
import { redis } from '@/lib/kv';

export default async function handler(req, res) {
  try {
    const token = await getAccessToken(req, res);
    if (!token) {
      return res.status(401).json({ ok: false, error: 'Not authenticated' });
    }

    // Load notebooks and sections from Graph
    const resp = await fetch("https://graph.microsoft.com/v1.0/me/onenote/notebooks?$expand=sections", {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!resp.ok) {
      const body = await resp.text();
      return res.status(resp.status).json({ ok: false, error: body });
    }

    const data = await resp.json();

    // Save into Redis
    await redis.set("onenote:index", JSON.stringify(data));

    res.json({ ok: true, count: data.value.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
