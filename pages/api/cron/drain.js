// /pages/api/cron/drain.js
//
// Purpose:
// - Runs on schedule (cron) or via manual trigger (/api/cron/drain)
// - Drains queue:v1 from KV, dedupes entries by dedupeKey
// - Posts each payload to Microsoft Graph (append or create page)
// - On error (401/403/Graph down): stop, preserve remaining items, surface "Re-auth needed"
// - Idempotent: safe to retry; dedupeKey avoids duplicate posts

import crypto from 'crypto';

async function getKV() {
  try {
    const mod = await import('@/lib/kv').catch(() => null);
    if (mod?.kv) return mod.kv;
  } catch (_) {}
  const mod2 = await import('@vercel/kv').catch(() => null);
  if (!mod2?.kv) {
    throw new Error('KV client not found. Ensure "@/lib/kv" exports { kv } or install @vercel/kv.');
  }
  return mod2.kv;
}

async function getGraph() {
  const mod = await import('@/lib/msgraph').catch(() => null);
  if (!mod?.graphClient) {
    throw new Error('Graph client missing. Ensure "@/lib/msgraph" exports { graphClient }.');
  }
  return mod.graphClient;
}

function stableHash(obj) {
  const json = typeof obj === 'string' ? obj : JSON.stringify(obj);
  return crypto.createHash('sha256').update(json).digest('hex').slice(0, 16);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  const kv = await getKV();
  const graph = await getGraph();

  const processed = [];
  const skipped = [];
  const errors = [];

  try {
    // Fetch and clear the queue atomically
    const len = await kv.llen('queue:v1');
    if (len === 0) {
      return res.status(200).json({ ok: true, drained: 0, processed, skipped, errors });
    }

    const items = [];
    for (let i = 0; i < len; i++) {
      const raw = await kv.rpop('queue:v1');
      if (raw) items.push(JSON.parse(raw));
    }

    // Deduplicate by dedupeKey
    const seen = new Set();
    for (const item of items) {
      const payload = item.payload;
      if (!payload?.dedupeKey) {
        payload.dedupeKey = stableHash(payload);
      }
      if (seen.has(payload.dedupeKey)) {
        skipped.push({ dedupeKey: payload.dedupeKey, reason: 'duplicate-in-batch' });
        continue;
      }
      seen.add(payload.dedupeKey);

      try {
        // Post via Graph client
        const result = await graph.postPayload(payload);
        processed.push({
          dedupeKey: payload.dedupeKey,
          pageKey: payload.appendTo?.pageKey,
          result,
        });
      } catch (err) {
        console.error('Graph post error:', err?.response?.data || err);
        // Re-queue on Graph error
        await kv.lpush('queue:v1', JSON.stringify(item));
        if (err?.response?.status === 401 || err?.response?.status === 403) {
          return res.status(200).json({
            ok: false,
            drained: processed.length,
            processed,
            skipped,
            errors: [...errors, { message: 'Re-auth needed', code: err?.response?.status }],
          });
        } else {
          errors.push({ message: String(err?.message || err), payload });
        }
      }
    }

    return res.status(200).json({
      ok: true,
      drained: items.length,
      processed,
      skipped,
      errors,
    });
  } catch (err) {
    console.error('drain.js error:', err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
