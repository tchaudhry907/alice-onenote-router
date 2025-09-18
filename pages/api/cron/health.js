// pages/api/cron/health.js
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  try {
    const qlen = await kv.llen('log:queue');
    const hasAccess = Boolean(await kv.get('graph:access_token') || await kv.get('graph:refresh_token'));

    res.status(200).json({
      ok: true,
      queueLength: qlen,
      graphTokenPresent: hasAccess,
      notes: hasAccess
        ? 'Graph token present (access and/or refresh).'
        : 'No Graph token present. Use your probe/auth flow to refresh.',
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
