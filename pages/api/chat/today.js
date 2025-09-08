// pages/api/chat/today.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const origin = `${proto}://${host}`;

    // 1) Get latest (your working route)
    const latestRes = await fetch(`${origin}/api/onenote/page-latest`, {
      headers: { ...(req.headers.cookie ? { cookie: req.headers.cookie } : {}) },
    });
    const latest = await latestRes.json().catch(() => ({}));
    if (!latestRes.ok || latest?.ok === false) {
      return res
        .status(latestRes.status || 500)
        .json({ ok: false, error: 'Failed to fetch latest page', detail: latest });
    }

    // shape can be { ok:true, id, title } or just {id,title}; normalize
    const pageId = latest.id || latest?.page?.id || latest?.created?.id;
    const title = latest.title || latest?.page?.title || latest?.created?.title;
    if (!pageId) {
      return res.status(404).json({ ok: false, error: 'No page found for today' });
    }

    // 2) Get plain text
    const textRes = await fetch(
      `${origin}/api/onenote/page-text?` + new URLSearchParams({ id: pageId }),
      { headers: { ...(req.headers.cookie ? { cookie: req.headers.cookie } : {}) } }
    );
    const textJson = await textRes.json().catch(() => ({}));
    if (!textRes.ok || textJson?.ok === false) {
      return res
        .status(textRes.status || 500)
        .json({ ok: false, error: 'Failed to fetch page text', detail: textJson });
    }

    return res.status(200).json({
      ok: true,
      id: pageId,
      title: title || 'Today',
      text: textJson.text || '',
      length: textJson.length ?? (textJson.text ? textJson.text.length : 0),
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
