// pages/api/onenote/index.js
// Robust OneNote router: tolerant section matching (hyphen vs en-dash, spacing, case)

import { getGraphToken } from '@/lib/auth-token';

function escapeHtml(s = '') {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

// Normalizer: lowercase, trim, collapse spaces, treat EN DASH and HYPHEN as same
function norm(s = '') {
  return s
    .replace(/\u2013/g, '-') // EN DASH → hyphen
    .replace(/\u2014/g, '-') // EM DASH → hyphen (just in case)
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
  // exact normalized match first
  let match = list.find(s => norm(s.displayName) === want);
  if (!match) {
    // try contains match as a gentle fallback (helps trailing spaces etc.)
    match = list.find(s => norm(s.displayName).includes(want) || want.includes(norm(s.displayName)));
  }
  if (!match) {
    const names = list.map(s => s.displayName).sort();
    throw new Error(`Section not found: ${sectionName}. Available: ${names.join(' | ')}`);
  }
  return match.id;
}

function buildHtml(title, htmlBody) {
  return `<!DOCTYPE html><html><head><title>${escapeHtml(title)}</title></head><body>${htmlBody || 'ok'}</body></html>`;
}

export default async function handler(req, res) {
  try {
    const { token, source } = await getGraphToken(req);
    if (!token) {
      return res.status(200).json({
        ok: false,
        error: 'No access token (header/cookie/KV). Open /debug/diagnostics → Force Microsoft Login.',
      });
    }

    if (req.method === 'GET') {
      const act = (req.query.act || '').toString();
      if (act === 'me') {
        const me = await gfetch(token, 'https://graph.microsoft.com/v1.0/me');
        return res.status(200).json({ ok: true, source, me });
      }
      return res.status(200).json({ ok: true, message: 'Use POST with { act: "create", ... } or GET ?act=me' });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const act = (body.act || '').toString();

      if (act === 'me') {
        const me = await gfetch(token, 'https://graph.microsoft.com/v1.0/me');
        return res.status(200).json({ ok: true, source, me });
      }

      if (act === 'create') {
        const notebookName = body.notebookName || 'AliceChatGPT';
        const sectionName = body.sectionName;
        const title = body.title || 'New Page';
        const html = body.html || 'ok';

        if (!sectionName) {
          return res.status(400).json({ ok: false, error: 'Missing sectionName' });
        }

        const nbId = await findNotebookId(token, notebookName);
        const secId = await findSectionId(token, nbId, sectionName);

        const r = await fetch(
          `https://graph.microsoft.com/v1.0/me/onenote/sections/${encodeURIComponent(secId)}/pages`,
          { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'text/html' }, body: buildHtml(title, html) }
        );
        const text = await r.text();
        let page; try { page = JSON.parse(text); } catch { page = { raw: text } }
        if (!r.ok) {
          return res.status(r.status).json({ ok: false, error: `${r.status} ${r.statusText}`, details: page });
        }
        return res.status(200).json({ ok: true, page });
      }

      return res.status(400).json({ ok: false, error: `Unknown act: ${act}` });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  } catch (e) {
    const status = e?.response?.status || 500;
    return res.status(status).json({ ok: false, error: e.message, details: e?.response });
  }
}
