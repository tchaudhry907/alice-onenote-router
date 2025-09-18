// pages/api/log.js
// POST { text: "walked 10000 steps" } -> creates a OneNote page in the correct section.

import { routeAndFormat } from '@/lib/intent-route';
import { getGraphToken } from '@/lib/auth-token';

// Normalizer: lowercase, trim, collapse spaces, treat EN/EM dashes as '-'
function norm(s = '') {
  return s
    .replace(/\u2013/g, '-') // EN DASH → hyphen
    .replace(/\u2014/g, '-') // EM DASH → hyphen
    .replace(/[ \t]+/g, ' ')
    .trim()
    .toLowerCase();
}

async function gfetch(token, url, init = {}) {
  const r = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) },
    cache: 'no-store',
  });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text } }
  if (!r.ok) {
    const err = new Error(`${r.status} ${r.statusText}`);
    err.response = { status: r.status, statusText: r.statusText, body: json };
    throw err;
  }
  return json;
}

async function findNotebookId(token, name) {
  const data = await gfetch(token, 'https://graph.microsoft.com/v1.0/me/onenote/notebooks?$select=id,displayName');
  const want = norm(name);
  const match = (data.value || []).find(n => norm(n.displayName) === want);
  if (!match) {
    const names = (data.value || []).map(n => n.displayName).sort();
    throw new Error(`Notebook not found: ${name}. Available: ${names.join(' | ')}`);
  }
  return match.id;
}

async function findSectionId(token, notebookId, sectionName) {
  const data = await gfetch(
    token,
    `https://graph.microsoft.com/v1.0/me/onenote/notebooks/${encodeURIComponent(notebookId)}/sections?$select=id,displayName`
  );
  const want = norm(sectionName);
  const list = (data.value || []);
  let match = list.find(s => norm(s.displayName) === want);
  if (!match) match = list.find(s => norm(s.displayName).includes(want) || want.includes(norm(s.displayName)));
  if (!match) {
    const names = list.map(s => s.displayName).sort();
    throw new Error(`Section not found: ${sectionName}. Available: ${names.join(' | ')}`);
  }
  return match.id;
}

function buildHtml(title, htmlBody) {
  const escTitle = title.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  return `<!DOCTYPE html><html><head><title>${escTitle}</title></head><body>${htmlBody || 'ok'}</body></html>`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const { token } = await getGraphToken(req);
    if (!token) return res.status(200).json({ ok: false, error: 'No access token. Open /debug/diagnostics → Force Microsoft Login.' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const text = (body.text || '').trim();
    if (!text) return res.status(400).json({ ok: false, error: 'Missing "text"' });

    // Route & format (decides target section + title + html)
    const { sectionName, title, html } = routeAndFormat(text);

    // Resolve IDs (your notebook is AliceChatGPT)
    const notebookName = 'AliceChatGPT';
    const nbId = await findNotebookId(token, notebookName);
    const secId = await findSectionId(token, nbId, sectionName);

    // Create page
    const r = await fetch(
      `https://graph.microsoft.com/v1.0/me/onenote/sections/${encodeURIComponent(secId)}/pages`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'text/html' }, body: buildHtml(title, html) }
    );
    const respText = await r.text();
    let page; try { page = JSON.parse(respText); } catch { page = { raw: respText } }
    if (!r.ok) return res.status(r.status).json({ ok: false, error: `${r.status} ${r.statusText}`, details: page });

    return res.status(200).json({ ok: true, routed: { sectionName, title }, page });
  } catch (e) {
    return res.status(e?.response?.status || 500).json({ ok: false, error: e.message, details: e.response });
  }
}
