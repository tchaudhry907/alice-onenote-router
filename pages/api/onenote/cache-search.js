import { redis } from '@/lib/kv';

export default async function handler(req, res) {
  try {
    const { q } = req.query;
    const raw = await redis.get("onenote:index");
    if (!raw) return res.json({ ok: false, error: "Cache empty" });

    const data = JSON.parse(raw);
    const hits = [];

    for (const nb of data.value) {
      for (const sec of nb.sections || []) {
        if (
          sec.displayName.toLowerCase().includes(q.toLowerCase())
        ) {
          hits.push({ notebook: nb.displayName, section: sec.displayName, id: sec.id });
        }
      }
    }

    res.json({ ok: true, hits });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
