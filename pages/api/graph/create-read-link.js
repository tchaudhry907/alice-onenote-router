// pages/api/graph/create-read-link.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const BEARER = process.env.ACTION_BEARER_TOKEN;
  if (!BEARER) {
    return res.status(500).json({ ok: false, error: 'Server not configured: ACTION_BEARER_TOKEN missing' });
  }

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : '';
  if (token !== BEARER) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const { title, html } = req.body || {};
  if (!title || !html) {
    return res.status(400).json({ ok: false, error: 'Missing title or html' });
  }

  try {
    // Build an internal base URL from the current request (no cookies needed)
    const proto = (req.headers['x-forwarded-proto'] || 'https');
    const host  = req.headers.host;
    const base  = `${proto}://${host}`;

    // 1) create page -> returns .created.id
    const createdResp = await fetch(`${base}/api/graph/page-create-to-inbox`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BEARER}`,       // internal auth
        'Content-Type' : 'application/json'
      },
      body: JSON.stringify({ title, html })
    });

    if (!createdResp.ok) {
      const text = await safeText(createdResp);
      return res.status(500).json({ ok: false, error: 'Failed to create page', details: text });
    }

    const createdJson = await createdResp.json();
    const pid = createdJson?.created?.id;
    if (!pid) {
      return res.status(500).json({ ok: false, error: 'No page id returned from create' });
    }

    // 2) read text
    const textResp = await fetch(`${base}/api/onenote/page-text?id=${encodeURIComponent(pid)}`, {
      headers: { 'Authorization': `Bearer ${BEARER}` }
    });
    if (!textResp.ok) {
      const text = await safeText(textResp);
      return res.status(500).json({ ok: false, error: 'Failed to read page text', details: text });
    }
    const textJson = await textResp.json();
    const pageText = textJson?.text ?? '';

    // 3) resolve links
    const linksResp = await fetch(`${base}/api/onenote/links`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BEARER}`,
        'Content-Type' : 'application/json'
      },
      body: JSON.stringify({ ids: [pid] })
    });
    if (!linksResp.ok) {
      const text = await safeText(linksResp);
      return res.status(500).json({ ok: false, error: 'Failed to resolve links', details: text });
    }
    const linksJson = await linksResp.json();
    const webUrl   = linksJson?.links?.[0]?.oneNoteWebUrl || null;
    const clientUrl= linksJson?.links?.[0]?.oneNoteClientUrl || null;

    return res.status(200).json({
      ok: true,
      created: { id: pid, title },
      text: pageText,
      links: { oneNoteWebUrl: webUrl, oneNoteClientUrl: clientUrl }
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'Unhandled error', details: String(e?.message || e) });
  }
}

async function safeText(resp) {
  try { return await resp.text(); } catch { return '<no text>';}
}
