// pages/api/graph/journal-sample.js
export default async function handler(req, res) {
  try {
    // ---- config (your Inbox section id) ----
    const INBOX_SECTION_ID = '0-824A10198D31C608!scfd7de0686df4aa1bc663dd4e7769585';

    // ---- access token from cookie (same pattern we’ve been using) ----
    const cookies = Object.fromEntries((req.headers.cookie || '')
      .split(';')
      .map(v => v.trim().split('=')));
    const accessToken = cookies['access_token'];
    if (!accessToken) {
      return res.status(401).json({ error: 'No access_token cookie' });
    }

    // ---- build simple XHTML body ----
    const now = new Date().toISOString();
    const html =
`<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head><title>Router Sample Page</title><meta http-equiv="Content-Type" content="text/html; charset=utf-8" /></head>
  <body>
    <h1>Router Sample Page</h1>
    <p>Created at ${now} via <code>/api/graph/journal-sample</code>.</p>
  </body>
</html>`;

    // ---- multipart per Graph requirements ----
    const boundary = 'batch_' + Math.random().toString(36).slice(2);
    const body =
`--${boundary}
Content-Disposition: form-data; name="Presentation"
Content-Type: text/html

${html}
--${boundary}--`;

    const url = `https://graph.microsoft.com/v1.0/me/onenote/sections/${encodeURIComponent(INBOX_SECTION_ID)}/pages`;
    const rsp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body
    });

    if (!rsp.ok) {
      const err = await rsp.json().catch(() => ({}));
      return res.status(500).json({ error: 'Create failed', details: err });
    }
    const json = await rsp.json();
    const link =
      json?.links?.oneNoteWebUrl?.href ||
      json?.contentUrl ||
      null;

    return res.status(200).json({
      created: {
        id: json.id,
        title: json.title,
        section: 'Inbox',
        notebook: 'AliceChatGPT',
        createdDateTime: json.createdDateTime,
        link
      },
      raw: json
    });
  } catch (e) {
    return res.status(500).json({ error: 'Unexpected', details: String(e) });
  }
}
