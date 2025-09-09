// pages/api/graph/create-read-link.js

import { getAccessToken } from '../../lib/auth'; // adjust path if needed

const ACTION_TOKEN_ENV = 'ACTION_BEARER_TOKEN';

// ====== CORS ======
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ====== AUTH CHECK ======
function assertBearer(req, res) {
  const expected = process.env[ACTION_TOKEN_ENV];
  if (!expected) {
    res.status(500).json({ ok: false, error: `Server misconfig: ${ACTION_TOKEN_ENV} not set` });
    return null;
  }
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    res.status(401).json({ ok: false, error: 'Missing Bearer token' });
    return null;
  }
  const token = auth.slice('Bearer '.length).trim();
  if (token !== expected) {
    res.status(401).json({ ok: false, error: 'Invalid token' });
    return null;
  }
  return true;
}

// ====== GRAPH HELPERS ======
async function graphFetch(path, { method = 'GET', headers = {}, body } = {}) {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error('Could not obtain Graph access token');
  const url = `https://graph.microsoft.com/v1.0${path}`;
  const res = await fetch(url, { method, headers: { Authorization: `Bearer ${accessToken}`, ...headers }, body });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`Graph ${method} ${path} -> ${res.status}`);
    err.status = res.status;
    err.body = text;
    throw err;
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

async function getNotebookIdByName(name) {
  const data = await graphFetch(`/me/onenote/notebooks?$select=id,displayName`);
  const hit = (data.value || []).find(n => n.displayName === name);
  if (!hit) throw new Error(`Notebook not found: ${name}`);
  return hit.id;
}

async function getSectionIdByName(notebookId, name) {
  const data = await graphFetch(`/me/onenote/notebooks/${encodeURIComponent(notebookId)}/sections?$select=id,displayName`);
  const hit = (data.value || []).find(s => s.displayName === name);
  if (!hit) throw new Error(`Section not found: ${name}`);
  return hit.id;
}

function buildMultipartForPageHtml(html, title) {
  const boundary = '----AliceOneLoggerV3' + Math.random().toString(36).slice(2);
  const head = `--${boundary}\r\nContent-Disposition: form-data; name="Presentation"\r\nContent-Type: text/html\r\n\r\n`;
  const htmlDoc = `<!DOCTYPE html><html><head><title>${title}</title></head><body>${html}</body></html>`;
  const tail = `\r\n--${boundary}--`;
  const body = Buffer.from(head + htmlDoc + tail, 'utf8');
  return { body, boundary };
}

async function createOneNotePage({ notebookName, sectionName, title, html }) {
  const nbId = await getNotebookIdByName(notebookName);
  const secId = await getSectionIdByName(nbId, sectionName);

  const { body, boundary } = buildMultipartForPageHtml(html, title);
  const created = await graphFetch(`/me/onenote/sections/${encodeURIComponent(secId)}/pages`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body
  });

  const pageId = created?.id;
  const links = created?.links || {};
  if (!pageId) throw new Error('Page creation failed, missing id');

  if (!links.oneNoteWebUrl || !links.oneNoteClientUrl) {
    const p = await graphFetch(`/me/onenote/pages/${encodeURIComponent(pageId)}?$select=id,links`);
    links.oneNoteWebUrl = p?.links?.oneNoteWebUrl || links.oneNoteWebUrl;
    links.oneNoteClientUrl = p?.links?.oneNoteClientUrl || links.oneNoteClientUrl;
  }

  return { pageId, links };
}

function stripHtml(html) {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function readPageFirstLines(pageId) {
  const html = await graphFetch(`/me/onenote/pages/${encodeURIComponent(pageId)}/content?includeIDs=true`, {
    headers: { Accept: 'text/html' }
  });
  const text = stripHtml(html);
  return text.slice(0, 600);
}

// ====== HANDLER ======
export default async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  if (!assertBearer(req, res)) return;

  try {
    const { title, html } = req.body || {};
    if (typeof title !== 'string' || typeof html !== 'string' || !title || !html) {
      return res.status(400).json({ ok: false, error: 'Invalid body: { title, html } are required strings' });
    }

    const NOTEBOOK = 'AliceChatGPT';
    const SECTION = 'Inbox';

    const { pageId, links } = await createOneNotePage({ notebookName: NOTEBOOK, sectionName: SECTION, title, html });
    const text = await readPageFirstLines(pageId);

    return res.status(200).json({ ok: true, created: { id: pageId }, text, links });
  } catch (err) {
    const status = err?.status || 500;
    const detail = err?.body || err?.message || 'Internal Error';
    return res.status(status).json({ ok: false, error: detail });
  }
}
