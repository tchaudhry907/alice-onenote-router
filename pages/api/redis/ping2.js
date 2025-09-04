// /pages/api/redis/ping2.js
import { Redis } from '@upstash/redis';

function mask(s = '', keep = 10) {
  if (!s) return '';
  if (s.length <= keep) return '*'.repeat(s.length);
  return s.slice(0, keep) + '…' + '*'.repeat(Math.max(0, s.length - keep - 1));
}

export default async function handler(req, res) {
  const url = process.env.UPSTASH_REDIS_REST_URL || '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || '';

  const env = {
    url: url || null,
    hasToken: Boolean(token),
    tokenHead: mask(token, 10),
    tokenLen: token.length,
  };

  if (!url || !token) {
    return res.status(500).json({
      ok: false,
      where: 'env',
      reason: 'Missing UPSTASH_REDIS_REST_URL and/or UPSTASH_REDIS_REST_TOKEN',
      env,
    });
  }

  try {
    const redis = new Redis({ url, token });
    const pong = await redis.ping();
    return res.status(200).json({ ok: true, pong, env });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      where: 'redis',
      reason: 'Ping failed',
      error: { name: err?.name || 'Error', message: err?.message || String(err) },
      env,
    });
  }
}
