// pages/api/log.js
// Hands-free text logger: classify → build payload → queue to KV

import { kv } from '@vercel/kv';
import { classifyText } from '@/lib/classify';
import { resolveSectionId, NOTEBOOK_NAME } from '@/lib/sections';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    const { text } = req.body;
    if (!text) {
      res.status(400).json({ ok: false, error: 'Missing text' });
      return;
    }

    // Step 1. classify
    const { category, titlePrefix } = classifyText(text);

    // Step 2. resolve section
    const sectionId = resolveSectionId(category);
    if (!sectionId) {
      res.status(400).json({ ok: false, error: `Unknown section for category: ${category}` });
      return;
    }

    // Step 3. build payload
    const ts = new Date().toISOString();
    const title = `[${titlePrefix}] ${text} (${ts.slice(0, 16)})`;
    const html = `<h2>${title}</h2><div><p>${text}</p></div>`;

    const payload = {
      route: { notebookName: NOTEBOOK_NAME, sectionName: category, sectionId },
      title,
      html,
      ts,
      dedupeKey: `${category}:${ts.slice(0, 10)}:${text}`,
    };

    // Step 4. push to queue (list in KV)
    await kv.lpush('log:queue', JSON.stringify(payload));

    res.status(200).json({ ok: true, routed: { sectionName: category, title }, queued: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
