// pages/api/log.js
//
// POST /api/log  { text: "freeform note" }
// Uses router to pick a OneNote section + title, then creates the page via /api/onenote.

import { routeText } from '@/lib/router';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const { text } = req.body || {};
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ ok: false, error: 'Provide { "text": "<what you did>" }' });
    }

    // Route to section/title/html
    const routed = routeText(text);

    // Create page via the existing onenote endpoint
    const base = process.env.NEXT_PUBLIC_BASE_URL || `https://${req.headers.host}`;
    const r = await fetch(`${base}/api/onenote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        act: 'create',
        notebookName: 'AliceChatGPT',
        sectionName: routed.sectionName,
        title: routed.title,
        html: routed.html,
      }),
    });

    if (!r.ok) {
      let details = null;
      try { details = await r.json(); } catch { /* ignore */ }
      return res.status(502).json({
        ok: false,
        error: `${r.status} ${r.statusText}`,
        details: details || null,
      });
    }

    const page = await r.json();
    return res.status(200).json({ ok: true, routed, page: page.page || page });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || String(e) });
  }
}
