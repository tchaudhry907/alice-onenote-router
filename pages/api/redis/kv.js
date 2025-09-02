// pages/api/redis/kv.js
import { getRedis } from '../../../lib/redis';

export default async function handler(req, res) {
  const redis = getRedis();

  // GET  -> read ?key=foo
  // POST -> write { key, value, ttlSeconds? }
  try {
    if (req.method === 'GET') {
      const { key = 'alice:test' } = req.query;
      const value = await redis.get(key);
      return res.status(200).json({ ok: true, key, value });
    }

    if (req.method === 'POST') {
      const { key = 'alice:test', value = Date.now(), ttlSeconds } =
        typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      if (ttlSeconds) {
        await redis.set(key, value, { ex: Number(ttlSeconds) });
      } else {
        await redis.set(key, value);
      }
      return res.status(200).json({ ok: true, key, value, ttlSeconds: ttlSeconds ?? null });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
