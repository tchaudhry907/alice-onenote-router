// pages/api/kv/diag.js
import { kvSet, kvGet, kvDel } from '@/lib/kv';

export default async function handler(req, res) {
  const report = { steps: {} };
  try {
    const key = 'health:kv:diag';
    const payload = { ts: Date.now() };

    try { report.steps.set = await kvSet(key, payload, { ex: 30 }); }
    catch (e) { report.steps.set = { error: e.message }; }

    try { report.steps.get = await kvGet(key); }
    catch (e) { report.steps.get = { error: e.message }; }

    try { report.steps.del = await kvDel(key); }
    catch (e) { report.steps.del = { error: e.message }; }

    res.status(200).json(report);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
