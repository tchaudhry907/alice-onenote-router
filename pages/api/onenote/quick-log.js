// pages/api/onenote/quick-log.js

const ACTION_TOKEN_ENV = 'ACTION_BEARER_TOKEN';
const GRAPH_TOKEN_ENV  = 'MS_GRAPH_ACCESS_TOKEN';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
function assertBearer(req, res) {
  const expected = process.env[ACTION_TOKEN_ENV];
  if (!expected) { res.status(500).json({ ok: false, error: `Server misconfig: ${ACTION_TOKEN_ENV} not set` }); return null; }
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) { res.status(401).json({ ok: false, error: 'Missing Bearer token' }); return null; }
  const token = auth.slice('Bearer '.length).trim();
  if (token !== expected) { res.status(401).json({ ok: false, error: 'Invalid token' }); return null; }
  return true;
}
async function graphFetch(path, { method = 'GET', headers = {}, body } = {}) {
  const accessToken = process.env[GRAPH_TOKEN_ENV];
  if (!accessToken) throw new Error(`Missing ${GRAPH_TOKEN_ENV} env var for Graph access`);
  const url = `https://graph.microsoft.com/v1.0${path}`;
  const res = await fetch(url, { method, headers: { 'Authorization': `Bearer ${accessToken}`, ...headers }, body });
  if (!res.ok) { const text = await res.text().catch(() => ''); const e = new Error(`Graph ${method} ${path} -> ${res.status}`); e.status = res.status; e.body = text; throw e; }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}
function buildMultipartForPageHtml(html, title) {
  const boundary = '----AliceOneLoggerV3' + Math.random().toString(36).slice(2);
  const head = `--${boundary}\r\nContent-Disposition: form-data; name="Presentation"\r\nContent-Type: text/html\r\n\r\n`;
  const htmlDoc = `<!DOCTYPE html><html><head><title>${title}</title></head><body>${html}</body></html>`;
  const tail = `\r\n--${boundary}--`;
  const body = Buffer.from(head + htmlDoc + tail, 'utf8');
  return { body, boundary };
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  if (!assertBearer(req, res)) return;

  try {
    const { text } = req.body || {};
    if (typeof text !== 'string' || !text) return res.status(400).json({ ok: false, error: 'Invalid body: { text } required' });

    // Append by creating a tiny page in Daily Log or Inbox (simplest general case = Inbox)
    const { body, boundary } = buildMultipartForPageHtml(`<p>${text}</p>`, '[QUICK-LOG]');
    // Target: Inbox section (simplified: resolve IDs each time; or cache if you prefer)
    const notebooks = await graphFetch(`/me/onenote/notebooks?$select=id,displayName`);
    const nb = (notebooks.value || []).find(n => n.displayName === 'AliceChatGPT');
    if (!nb) throw new Error('Notebook not found: AliceChatGPT');
    const sections = await graphFetch(`/me/onenote/notebooks/${encodeURIComponent(nb.id)}/sections?$select=id,displayName`);
    const inbox = (sections.value || []).find(s => s.displayName === 'Inbox');
    if (!inbox) throw new Error('Section not found: Inbox');

    await graphFetch(`/me/onenote/sections/${encodeURIComponent(inbox.id)}/pages`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    const status = err?.status || 500;
    const detail = err?.body || err?.message || 'Internal Error';
    return res.status(status).json({ ok: false, error: detail });
  }
}
