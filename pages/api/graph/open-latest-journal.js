// pages/api/graph/open-latest-journal.js
export default async function handler(req, res) {
  try {
    const INBOX_SECTION_ID = '0-824A10198D31C608!scfd7de0686df4aa1bc663dd4e7769585';

    const cookies = Object.fromEntries((req.headers.cookie || '')
      .split(';')
      .map(v => v.trim().split('=')));
    const accessToken = cookies['access_token'];
    if (!accessToken) {
      return res.status(401).json({ error: 'No access_token cookie' });
    }

    const url = `https://graph.microsoft.com/v1.0/me/onenote/sections/${encodeURIComponent(INBOX_SECTION_ID)}/pages?$top=1&$orderby=createdDateTime desc`;
    const rsp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!rsp.ok) {
      const err = await rsp.json().catch(() => ({}));
      return res.status(rsp.status).json({ error: 'List failed', details: err });
    }

    const data = await rsp.json();
    const latest = data?.value?.[0];
    if (!latest) {
      return res.status(404).json({ error: 'No pages found in Inbox' });
    }

    const target =
      latest?.links?.oneNoteWebUrl?.href ||
      latest?.contentUrl ||
      null;

    if (!target) {
      return res.status(200).json({ info: 'Latest page found, but no web url; returning JSON.', latest });
    }

    // 302 redirect to the page
    res.setHeader('Location', target);
    return res.status(302).end();
  } catch (e) {
    return res.status(500).json({ error: 'Unexpected', details: String(e) });
  }
}
