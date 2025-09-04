// /pages/api/debug/env.js
function mask(s = '', keep = 10) {
  if (!s) return '';
  if (s.length <= keep) return '*'.repeat(s.length);
  return s.slice(0, keep) + '…' + '*'.repeat(Math.max(0, s.length - keep - 1));
}

export default function handler(req, res) {
  const url = process.env.UPSTASH_REDIS_REST_URL || null;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || '';
  res.status(200).json({
    ok: true,
    url,
    hasToken: Boolean(token),
    tokenHead: mask(token, 10),
    tokenLen: token.length,
  });
}
