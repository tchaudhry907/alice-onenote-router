import { getAccessToken, requireAuth } from '../../../lib/auth.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function graphFetch(path, { method='GET', headers={}, body } = {}) {
  const token = await getAccessToken();
  const url = `https://graph.microsoft.com/v1.0${path}`;
  const r = await fetch(url, { method, headers:{ Authorization:`Bearer ${token}`, ...headers }, body });
  if (!r.ok) { const text = await r.text().catch(()=>''); const e=new Error(text); e.status=r.status; throw e; }
  const ct = r.headers.get('content-type') || '';
  return ct.includes('application/json') ? r.json() : r.text();
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Method Not Allowed' });
  if (!requireAuth(req, res)) return;

  try {
    const { text } = req.body || {};
    if (!text) return res.status(400).json({ ok:false, error:'text required' });

    const nbs = await graphFetch(`/me/onenote/notebooks?$select=id,displayName`);
    const nb = (nbs.value || []).find(n => n.displayName === 'AliceChatGPT');
    if (!nb) throw new Error('Notebook not found: AliceChatGPT');

    const secs = await graphFetch(`/me/onenote/notebooks/${encodeURIComponent(nb.id)}/sections?$select=id,displayName`);
    const inbox = (secs.value || []).find(s => s.displayName === 'Inbox');
    if (!inbox) throw new Error('Section not found: Inbox');

    const boundary = '----AliceOneLoggerV3' + Math.random().toString(36).slice(2);
    const head = `--${boundary}\r\nContent-Disposition: form-data; name="Presentation"\r\nContent-Type: text/html\r\n\r\n`;
    const htmlDoc = `<!DOCTYPE html><html><head><title>[QUICK-LOG]</title></head><body><p>${text}</p></body></html>`;
    const tail = `\r\n--${boundary}--`;
    const body = Buffer.from(head + htmlDoc + tail, 'utf8');

    await graphFetch(`/me/onenote/sections/${encodeURIComponent(inbox.id)}/pages`, {
      method:'POST', headers:{ 'Content-Type': `multipart/form-data; boundary=${boundary}` }, body
    });

    return res.status(200).json({ ok:true });
  } catch (err) {
    if (err?.auth_required) {
      return res.status(401).json({ ok:false, error:'AUTH_REQUIRED',
        next:{ how:'POST /api/auth/device-code {"action":"begin"} then poll with {"action":"poll"}' } });
    }
    const status = err?.status || 500;
    return res.status(status).json({ ok:false, error: err?.message || 'Internal Error' });
  }
}
