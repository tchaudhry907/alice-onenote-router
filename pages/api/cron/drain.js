// pages/api/cron/drain.js
// Cron executor: pull payloads from KV queue and create OneNote pages.

import { kv } from '@vercel/kv';
import { createPage } from '@/lib/msgraph';

const MAX_PER_RUN = parseInt(process.env.CRON_MAX_ITEMS || '20', 10);

export default async function handler(req, res) {
  // Allow GET (cron pings) and POST (manual)
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const results = [];
  let processed = 0;
  let failures = 0;

  try {
    for (; processed < MAX_PER_RUN; processed++) {
      const raw = await kv.rpop('log:queue'); // we used LPUSH, so drain with RPOP (FIFO)
      if (!raw) break;

      let item;
      try {
        item = JSON.parse(raw);
      } catch (e) {
        failures++;
        results.push({ ok: false, error: 'Bad JSON payload', raw });
        continue;
      }

      const { route, title, html } = item;
      if (!route?.sectionId || !title || !html) {
        failures++;
        results.push({ ok: false, error: 'Missing required fields', item });
        continue;
      }

      try {
        const page = await createPage({
          sectionId: route.sectionId,
          title,
          html,
        });
        results.push({ ok: true, pageTitle: page?.title ?? title, sectionId: route.sectionId });
      } catch (err) {
        failures++;
        // Push back once if Graph hiccups (simple retry-once)
        await kv.lpush('log:queue', JSON.stringify(item));
        results.push({ ok: false, error: err.message });
        break; // bail early to avoid burning through rate limits
      }
    }

    res.status(200).json({
      ok: true,
      processed,
      failures,
      remaining: await kv.llen('log:queue'),
      items: results,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message, processed, failures, items: results });
  }
}
