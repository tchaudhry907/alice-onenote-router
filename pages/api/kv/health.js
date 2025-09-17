// pages/api/kv/health.js
import { kv } from '@/lib/kv';

export default async function handler(req, res) {
  try {
    const payload = { ok: true, ts: Date.now() };
    await kv.set('health:kv', payload, { ex: 30 }); // POST /set/...
    const got = await kv.get('health:kv');          // GET  /get/...
    await kv.del('health:kv');                      // POST /del/...
    res.status(200).json({
      wrote: payload,
      read: got,
      match: JSON.stringify(payload) === JSON.stringify(got),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
