// pages/api/onenote/log.js
// Full replacement — append a line to today's OneNote page using Graph JSON commands (no multipart)

import { NextResponse } from 'next/server';

// ==== Config you can tweak if you want ====
const DEFAULT_NOTEBOOK_NAME = process.env.ONE_NOTE_NOTEBOOK_NAME || 'Alice Router';
const DEFAULT_SECTION_NAME  = process.env.ONE_NOTE_SECTION_NAME  || 'Router Logs';
// ==========================================

/**
 * Minimal Upstash KV REST helpers (uses standard Vercel env names already in your project)
 */
const KV_URL   = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
async function kvGet(key) {
  if (!KV_URL || !KV_TOKEN) throw new Error('KV not configured');
  const r = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    cache: 'no-store',
  });
  const j = await r.json();
  return j?.result ?? null; // Upstash returns { result: "..." } or null
}
async function kvSet(key, value) {
  if (!KV_URL || !KV_TOKEN) throw new Error('KV not configured');
  const r = await fetch(`${KV_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    cache: 'no-store',
  });
  return r.ok;
}

function json(res, status = 200) {
  return new Response(JSON.stringify(res), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function todayYMD(tz = 'America/New_York') {
  const now = new Date();
  const y = now.toLocaleString('en-CA', { timeZone: tz, year: 'numeric' });
  const m = now.toLocaleString('en-CA', { timeZone: tz, month: '2-digit' });
  const d = now.toLocaleString('en-CA', { timeZone: tz, day: '2-digit' });
  return `${y}-${m}-${d}`;
}

async function graphFetch(path, { method = 'GET', accessToken, headers = {}, body } = {}) {
  if (!accessToken) throw new Error('Missing access token');
  const url = path.startsWith('http') ? path : `https://graph.microsoft.com/v1.0${path}`;
  const r = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      ...headers,
    },
    body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    cache: 'no-store',
  });

  if (!r.ok) {
    const text = await r.text().catch(() => '');
    const err = new Error(`Graph ${method} ${path} failed: ${r.status}`);
    err.status = r.status;
    err.body = text;
    throw err;
  }
  if (r.status === 204) return null;
  return r.json();
}

// Ensure notebook exists (by displayName)
async function ensureNotebook(accessToken, name = DEFAULT_NOTEBOOK_NAME) {
  const list = await graphFetch(`/me/onenote/notebooks?$select=id,displayName`, { accessToken });
  let nb = list.value.find(n => n.displayName === name);
  if (nb) return nb;

  // Create notebook
  // Notebook creation is under /me/onenote/notebooks (POST, body { displayName })
  nb = await graphFetch(`/me/onenote/notebooks`, {
    method: 'POST',
    accessToken,
    body: { displayName: name },
  });
  return nb;
}

// Ensure section exists within a notebook
async function ensureSection(accessToken, notebookId, sectionName = DEFAULT_SECTION_NAME) {
  const list = await graphFetch(`/me/onenote/notebooks/${notebookId}/sections?$select=id,displayName`, { accessToken });
  let sec = list.value.find(s => s.displayName === sectionName);
  if (sec) return sec;

  sec = await graphFetch(`/me/onenote/notebooks/${notebookId}/sections`, {
    method: 'POST',
    accessToken,
    body: { displayName: sectionName },
  });
  return sec;
}

// Find or create today's page in the section
async function ensureTodaysPage(accessToken, sectionId, ymd) {
  const pages = await graphFetch(`/me/onenote/sections/${sectionId}/pages?$select=id,title,createdDateTime&top=50`, { accessToken });
  const title = `Router — ${ymd}`;
  let page = pages.value.find(p => p.title === title);
  if (page) return page;

  // Create a simple HTML page
  const html =
    `<!DOCTYPE html><html><head><title>${title}</title><meta name="created" content="${new Date().toISOString()}"/></head>` +
    `<body><h1>${title}</h1><p>Log started ${new Date().toLocaleString()}</p></body></html>`;

  const r = await fetch(`https://graph.microsoft.com/v1.0/me/onenote/sections/${sectionId}/pages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'text/html',
    },
    body: html,
  });

  if (!r.ok) {
    const text = await r.text().catch(() => '');
    const err = new Error(`Create page failed: ${r.status}`);
    err.status = r.status;
    err.body = text;
    throw err;
  }
  return r.json();
}

// Append a paragraph line to a page using JSON commands
async function appendLine(accessToken, pageId, text) {
  // Escape minimal HTML in text and wrap as a paragraph
  const safe = String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const content = `<p data-tag="p">${safe}</p>`;

  const body = [
    {
      target: 'body',
      action: 'append',
      position: 'after',
      content,
    },
  ];

  // IMPORTANT: OneNote wants application/json for content commands
  const r = await fetch(`https://graph.microsoft.com/v1.0/me/onenote/pages/${pageId}/content`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const textResp = await r.text().catch(() => '');
    const err = new Error(`Append failed: ${r.status}`);
    err.status = r.status;
    err.body = textResp;
    throw err;
  }
  return true;
}

export default async function handler(req) {
  try {
    if (req.method !== 'POST') {
      return json({ ok: false, error: 'Use POST with JSON { "text": "..." }' }, 405);
    }

    const { text } = await (async () => {
      try { return await req.json(); } catch { return {}; }
    })();

    if (!text || typeof text !== 'string') {
      return json({ ok: false, error: 'Missing "text" string in body' }, 400);
    }

    // 1) Get tokens from KV
    const raw = await kvGet('msauth:default');
    if (!raw) {
      return json({
        ok: false,
        error: 'No tokens in KV. Visit /api/auth/refresh in a logged-in browser first.',
      }, 401);
    }

    let parsed;
    try { parsed = JSON.parse(raw); } catch { /* might already be object-ish */ parsed = raw; }
    const accessToken = parsed?.access;
    const refreshToken = parsed?.refresh;

    if (!accessToken) {
      return json({
        ok: false,
        error: 'Missing access token in KV. Go to /api/auth/refresh in your signed-in session.',
      }, 401);
    }
    if (!refreshToken) {
      // Not fatal for now, but warn
      console.warn('Warning: no refresh token in KV — future calls may expire.');
    }

    // 2) Ensure notebook/section/page
    const ymd = todayYMD();
    const nb = await ensureNotebook(accessToken, DEFAULT_NOTEBOOK_NAME);
    const sec = await ensureSection(accessToken, nb.id, DEFAULT_SECTION_NAME);
    const page = await ensureTodaysPage(accessToken, sec.id, ymd);

    // 3) Append the line
    await appendLine(accessToken, page.id, text);

    return json({
      ok: true,
      notebook: { id: nb.id, name: nb.displayName },
      section: { id: sec.id, name: sec.displayName },
      page: { id: page.id, title: page.title },
      appended: text,
    });
  } catch (err) {
    const status = err?.status || 500;
    return json({
      ok: false,
      error: err?.message || 'Append failed',
      detail: { status, body: err?.body || null },
    }, status);
  }
}

// Ensure the API route is not statically optimized
export const config = { api: { bodyParser: false } };
