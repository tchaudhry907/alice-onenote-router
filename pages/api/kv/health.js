// pages/api/kv/health.js
import { kv } from '@/lib/kv';

export default async function handler(req, res) {
  try {
    const payload = { ok: true, ts: Date.now() };

    // Write a value
    await kv.set('health:kv', payload, { ex: 30 });

    // Read it back
    const got = await kv.get('health:kv');

    // Delete
    await kv.del('health:kv');

    res.status(200).json({
      wrote: payload,
      read: got,
      match: JSON.stringify(payload) === JSON.stringify(got),
    });
  } catch (e) {
    res.status(500).json({ error: e.message, stack: e.stack });
  }
}
