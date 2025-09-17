// pages/api/onenote/index.js
import { getGraphToken, isJwt } from '@/lib/auth-token';

async function gfetch(token, url, init = {}) {
  const r = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!r.ok) {
    const err = new Error(`${r.status} ${r.statusText}`);
    err.response = { status: r.status, statusText: r.statusText, body: json };
    throw err;
  }
  return json;
}

async function findNotebookId(token, name) {
  const data = await gfetch(token, 'https://graph.microsoft.com/v1.0/me/onenote/notebooks?$select=id,displayName');
  const match = (data.value || []).find(n => (n.displayName || '').trim() === name.trim());
  if (!match) throw new Error(`Notebook not found: ${name}`);
  return match.id;
}

async function findSectionId(token, notebookId, sectionName) {
  const data = await gfetch(token, `https://graph.microsoft.com/v1.0/me/onenote/notebooks/${encodeURIComponent(notebookId)}/sections?$select=id,displayName`);
  const match = (data.value || []).find(s => (s.displayName || '').trim() === sectionName.trim());
  if (!match) throw new Error(`Section not found: ${sectionName}`);
  return match.id;
}

async function createPageInSection(token, sectionId, title, html) {
  // OneNote create page: POST HTML multipart
  // Minimal HTML works; title is set via <title> in the HTML payload.
  const content =
    `<!DOCTYPE html><html><head><title>${escapeHtml(title)}</title></head><body>${html || 'ok'}</body></html>`;

  const r = await fetch(`https://graph.microsoft.com/v1.0/me/onenote/sections/${encodeURIComponent(sectionId)}/pages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'text/html',
    },
    body: content,
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

function escapeHtml(s = '') {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

export default async function handler(req, res) {
  try {
    const { token, source } = await getGraphToken(req);
    if (!token) {
      return res.status(200).json({ ok: false, error: 'No access token (header/cookie/KV). Open /debug/diagnostics and Seed or Force Login first.' });
    }

    // GET ?act=me
    if (req.method === 'GET') {
      const act = (req.query.act || '').toString();
      if (act === 'me') {
        const data = await gfetch(token, 'https://graph.microsoft.com/v1.0/me');
        return res.status(200).json({ ok: true, source, tokenLooksJwt: isJwt(token), me: data });
      }
      return res.status(200).json({ ok: true, message: 'Use POST with { act: "create", ... } or GET ?act=me' });
    }

    // POST actions
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const act = (body.act || '').toString();

      if (act === 'me') {
        const data = await gfetch(token, 'https://graph.microsoft.com/v1.0/me');
        return res.status(200).json({ ok: true, source, tokenLooksJwt: isJwt(token), me: data });
      }

      if (act === 'create') {
        const { notebookName, sectionName, title, html } = body;
        if (!notebookName || !sectionName || !title) {
          return res.status(400).json({ ok: false, error: 'Missing notebookName, sectionName, or title' });
        }
        const nbId = await findNotebookId(token, notebookName);
        const secId = await findSectionId(token, nbId, sectionName);
        const page = await createPageInSection(token, secId, title, html || 'ok');
        return res.status(200).json({ ok: true, page });
      }

      return res.status(400).json({ ok: false, error: `Unknown act: ${act}` });
    }

    // Other methods
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  } catch (e) {
    // Bubble up Graph errors cleanly
    const status = e?.response?.status || 500;
    return res.status(status).json({
      ok: false,
      error: e.message,
      details: e?.response || undefined,
    });
  }
}
