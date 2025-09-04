// /pages/api/redis/ping.js
import { ping as kvPing } from '@/lib/kv';

function mask(s = '', keep = 6) {
  if (!s) return '';
  if (s.length <= keep) return '*'.repeat(s.length);
  return s.slice(0, keep) + '…' + '*'.repeat(Math.max(0, s.length - keep - 1));
}

export default async function handler(req, res) {
  const verbose = String(req.query.verbose || '').toLowerCase() === '1';

  // Always return env presence to help debug (values are masked)
  const envInfo = {
    url: process.env.UPSTASH_REDIS_REST_URL || null,
    hasToken: Boolean(process.env.UPSTASH_REDIS_REST_TOKEN),
    tokenHead: mask(process.env.UPSTASH_REDIS_REST_TOKEN || '', 10),
    tokenLen: (process.env.UPSTASH_REDIS_REST_TOKEN || '').length,
  };

  try {
    const pong = await kvPing();
    return res.status(200).json({ ok: true, pong, env: envInfo });
  } catch (err) {
    const body = {
      ok: false,
      reason: 'Redis ping failed',
      error: {
        name: err?.name || 'Error',
        message: err?.message || String(err),
      },
      env: envInfo,
    };
    if (verbose) body.error.stack = err?.stack || null;
    return res.status(500).json(body);
  }
}
