// pages/api/ingest.js
import { parse } from 'cookie';
import CryptoJS from 'crypto-js';

const TENANT = process.env.MS_TENANT || 'consumers';
const TOKEN_URL = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`;
const GRAPH = 'https://graph.microsoft.com/v1.0';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const cookies = parse(req.headers.cookie || '');
    if (!cookies.rt) return res.status(401).json({ error: 'Not authenticated. Visit /api/auth/login first.' });

    const refresh_token = CryptoJS.AES.decrypt(cookies.rt, process.env.ENCRYPTION_SECRET)
      .toString(CryptoJS.enc.Utf8);

    // Get access token from refresh
    const form = new URLSearchParams({
      client_id: process.env.MS_CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token,
      redirect_uri: process.env.REDIRECT_URI
    });

    const tr = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form
    });
    const tj = await tr.json();
    if (!tr.ok) return res.status(400).json({ error: 'Token refresh failed', details: tj });

    // Read body
    const body = await readJson(req);
    const { type, text, image_url, tags } = body || {};
    if (!type || !text) return res.status(400).json({ error: 'type and text are required' });

    // Ensure structure + target page
    const ids = await ensureStructure(tj.access_token);
    const page = await getOrCreatePage(tj.access_token, ids, type);

    // Append entry
    const html = buildEntryHTML({ type, text, image_url, tags });
    const patch = await fetch(`${GRAPH}/me/onenote/pages/${page.id}/content`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${tj.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([{ target: 'body', action: 'append', position: 'after', content: html }])
    });

    if (!patch.ok) {
      return res.status(400).json({ error: 'OneNote append failed', details: await patch.text() });
    }

    res.status(200).json({ ok: true, pageId: page.id });
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
}

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { return {}; }
}

async function ensureStructure(bearer) {
  // Find/create notebook and sections
  const nb = await (await fetch(`${GRAPH}/me/onenote/notebooks?$select=id,displayName`, {
    headers: { Authorization: `Bearer ${bearer}` }
  })).json();

  let hub = nb.value?.find(n => n.displayName === 'Alice Hub') || nb.value?.[0];
  if (!hub) {
    // Create a seed page to force notebook surface
    await fetch(`${GRAPH}/me/onenote/pages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'text/html' },
      body: `<html><head><title>Alice Hub (init)</title></head><body>Init</body></html>`
    });
    const nb2 = await (await fetch(`${GRAPH}/me/onenote/notebooks?$select=id,displayName`, {
      headers: { Authorization: `Bearer ${bearer}` }
    })).json();
    hub = nb2.value?.find(n => n.displayName === 'Alice Hub') || nb2.value?.[0];
  }

  const want = ['Daily Diary', 'FoodLog', 'GymLog', 'Wardrobe', 'Reference Items'];
  const sec = await (await fetch(`${GRAPH}/me/onenote/notebooks/${hub.id}/sections?$select=id,displayName`, {
    headers: { Authorization: `Bearer ${bearer}` }
  })).json();

  const map = {};
  for (const label of want) {
    let s = sec.value?.find(x => x.displayName === label);
    if (!s) {
      s = await (await fetch(`${GRAPH}/me/onenote/notebooks/${hub.id}/sections`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: label })
      })).json();
    }
    map[label] = s.id;
  }
  return { hubId: hub.id, sections: map };
}

async function getOrCreatePage(bearer, ids, type) {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  let sectionId, title;
  if (type === 'diary') { sectionId = ids.sections['Daily Diary']; title = `Diary — ${ym}`; }
  else if (type === 'food') { sectionId = ids.sections['FoodLog']; title = `FoodLog — ${ym}`; }
  else if (type === 'gym') { sectionId = ids.sections['GymLog']; title = `GymLog — ${ym}`; }
  else if (type === 'wardrobe') { sectionId = ids.sections['Wardrobe']; title = 'Wardrobe — Items'; }
  else { sectionId = ids.sections['Reference Items']; title = 'Reference Items'; }

  const pages = await (await fetch(`${GRAPH}/me/onenote/sections/${sectionId}/pages?$select=id,title`, {
    headers: { Authorization: `Bearer ${bearer}` }
  })).json();

  let page = pages.value?.find(p => p.title === title);
  if (!page) {
    const html = `<html><head><title>${escapeHtml(title)}</title></head><body><p>Init</p></body></html>`;
    const create = await fetch(`${GRAPH}/me/onenote/sections/${sectionId}/pages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'text/html' },
      body: html
    });
    const txt = await create.text();
    if (!create.ok) throw new Error(`Create page failed: ${txt}`);
    try { page = JSON.parse(txt); } catch {
      const reread = await (await fetch(`${GRAPH}/me/onenote/sections/${sectionId}/pages?$select=id,title`, {
        headers: { Authorization: `Bearer ${bearer}` }
      })).json();
      page = reread.value?.find(p => p.title === title);
    }
  }
  return page;
}

function buildEntryHTML({ type, text, image_url, tags }) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const tagStr = (tags && tags.length) ? `<div data-tags="${tags.map(escapeHtml).join(',')}"></div>` : '';
  const img = image_url ? `<img src="${image_url}" style="max-width:480px;height:auto;" />` : '';
  return `<div style="margin:12px 0;">
    <p><b>[${ts}]</b> — ${escapeHtml(text)}</p>
    ${img}
    ${tagStr}
    <hr/>
  </div>`;
}

function escapeHtml(s='') {
  return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
