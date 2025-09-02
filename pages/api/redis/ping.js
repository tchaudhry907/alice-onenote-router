import { redis } from '../../../lib/redis';

export default async function handler(req, res) {
  try {
    await redis.set('router:ping', 'pong', { ex: 60 });
    const value = await redis.get('router:ping');
    return res.status(200).json({ ok: true, value });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
