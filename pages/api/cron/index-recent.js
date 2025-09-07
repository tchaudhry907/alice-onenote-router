// /pages/api/cron/index-recent.js
import { getAccessToken } from '@/lib/auth';
import { searchIndexedText, indexPageText } from '@/lib/indexer';

export default async function handler(req, res) {
  try {
    const token = await getAccessToken(req, res);
    if (!token) return res.status(401).json({ ok: false, error: 'Not authenticated' });

    // TODO: fetch recent pages from Graph and index their plain text:
    // const pages = await fetch('https://graph.microsoft.com/v1.0/me/onenote/pages?$top=25&orderby=lastModifiedDateTime desc', { headers: { Authorization: `Bearer ${token}` } }).then(r=>r.json());
    // for (const p of pages.value) {
    //   const html = await fetch(`${p.contentUrl}`, { headers: { Authorization: `Bearer ${token}` } }).then(r=>r.text());
    //   const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g,' ').trim();
    //   await indexPageText(p.id, text, { title: p.title, ts: Date.parse(p.lastModifiedDateTime) });
    // }

    // For now just prove endpoint is alive
    const sample = await searchIndexedText('oatmeal', 5);
    res.json({ ok: true, indexedSample: sample.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
