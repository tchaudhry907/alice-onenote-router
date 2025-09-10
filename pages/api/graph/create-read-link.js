import { getAccessToken, requireAuth } from '../../../lib/auth.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function graphFetch(path, { method = 'GET', headers = {}, body } = {}) {
  const token = await getAccessToken();
  const url = `https://graph.microsoft.com/v1.0${path}`;
  const r = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, ...headers }, body });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    const e = new Error(`Graph ${method} ${path} -> ${r.status}`);
    e.status = r.status; e.body = text; throw e;
  }
  const ct = r.headers.get('content-type') || '';
  return ct.includes('application/json') ? r.json() : r.text();
}

function stripHtml(html) {
  return String(html).replace(/<style[\s\S]*?<\/style>/gi,'')
    .replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<[^>]+>/g,' ')
    .replace(/\s+/g,' ').trim();
}

async function createPageInInbox(title, html) {
  // Use /me because delegated auth runs under your user identity
  const nbs = await graphFetch(`/me/onenote/notebooks?$select=id,displayName`);
  const nb = (nbs.value || []).find(n => n.displayName === 'AliceChatGPT');
  if (!nb) throw new Error('Notebook not found: AliceChatGPT');

  const secs = await graphFetch(`/me/onenote/notebooks/${encodeURIComponent(nb.id)}/sections?$select=id,displayName`);
  const inbox = (secs.value || []).find(s => s.displayName === 'Inbox');
  if (!inbox) throw new Error('Section not found: Inbox');

  // multipart body
  const boundary = '----AliceOneLoggerV3' + Math.random().toString(36).slice(2);
  const head = `--${boundary}\r\nContent-Disposition: form-data; name="Presentation"\r\nContent-Type: text/html\r\n\r\n`;
  const htmlDoc = `<!DOCTYPE html><html><head><title>${title}</title></head><body>${html}</body></html>`;
  const tail = `\r\n--${boundary}--`;
  const body = Buffer.from(head + htmlDoc + tail, 'utf8');

  const created = await graphFetch(`/me/onenote/sections/${encodeURIComponent(inbox.id)}/pages`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body
  });

  const pageId = created?.id;
  const links = created?.links || {};
  if (!pageId) throw new Error('Page creation failed');

  // read first lines
  const htmlStr = await graphFetch(`/me/onenote/pages/${encodeURIComponent(pageId)}/content?includeIDs=true`, {
    headers: { Accept: 'text/html' }
  });
  const text = stripHtml(htmlStr).slice(0, 600);

  // ensure links
  if (!links.oneNoteWebUrl || !links.oneNoteClientUrl) {
    const p = await graphFetch(`/me/onenote/pages/${encodeURIComponent(pageId)}?$select=id,links`);
    links.oneNoteWebUrl = p?.links?.oneNoteWebUrl || links.oneNoteWebUrl;
    links.oneNoteClientUrl = p?.links?.oneNoteClientUrl || links.oneNoteClientUrl;
  }

  return { pageId, text, links };
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  if (!requireAuth(req, res)) return;

  try {
    const { title, html } = req.body || {};
    if (!title || !html) return res.status(400).json({ ok: false, error: 'Invalid body: title, html required' });

    const out = await createPageInInbox(title, html);
    return res.status(200).json({ ok: true, created: { id: out.pageId }, text: out.text, links: out.links });
  } catch (err) {
    if (err?.auth_required) {
      return res.status(401).json({
        ok: false,
        error: 'AUTH_REQUIRED',
        next: {
          how: 'POST /api/auth/device-code { "action": "begin" } then poll with { "action": "poll" }'
        }
      });
    }
    const status = err?.status || 500;
    const detail = err?.body || err?.message || 'Internal Error';
    return res.status(status).json({ ok: false, error: detail });
  }
}
