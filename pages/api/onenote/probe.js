// pages/api/onenote/probe.js
// Full replacement. Verifies notebook, section, and today's page IDs.

const KV_URL   = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const DEFAULT_NOTEBOOK_NAME = process.env.ONE_NOTE_NOTEBOOK_NAME || 'Alice Router';
const DEFAULT_SECTION_NAME  = process.env.ONE_NOTE_SECTION_NAME  || 'Router Logs';

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

async function kvGet(key) {
  if (!KV_URL || !KV_TOKEN) throw new Error('KV not configured');
  const r = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    cache: 'no-store',
  });
  const j = await r.json();
  return j?.result ?? null;
}

async function graph(path, { method='GET', token, headers={}, body } = {}) {
  const url = path.startsWith('http') ? path : `https://graph.microsoft.com/v1.0${path}`;
  const r = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...headers,
    },
    body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    cache: 'no-store',
  });
  const text = await r.text().catch(()=>'');
  if (!r.ok) return json({ ok:false, stage:'graph', method, url, status:r.status, body:text }, r.status);
  try { return json({ ok:true, stage:'graph', method, url, status:r.status, body: JSON.parse(text) }); }
  catch { return json({ ok:true, stage:'graph', method, url, status:r.status, body: text }); }
}

function todayYMD(tz='America/New_York'){
  const now = new Date();
  const y = now.toLocaleString('en-CA', { timeZone: tz, year:'numeric' });
  const m = now.toLocaleString('en-CA', { timeZone: tz, month:'2-digit' });
  const d = now.toLocaleString('en-CA', { timeZone: tz, day:'2-digit' });
  return `${y}-${m}-${d}`;
}

export default async function handler() {
  try {
    const raw = await kvGet('msauth:default');
    if (!raw) return json({ ok:false, error:'No tokens in KV. Visit /api/auth/refresh in a signed-in browser.' }, 401);
    const tok = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const access = tok?.access;
    if (!access) return json({ ok:false, error:'KV missing access token' }, 401);

    // 1) Notebook list
    const nbs = await fetch(`https://graph.microsoft.com/v1.0/me/onenote/notebooks?$select=id,displayName`, {
      headers: { Authorization: `Bearer ${access}` }, cache:'no-store'
    });
    const nbsJson = await nbs.json();
    if (!nbs.ok) return json({ ok:false, stage:'list-notebooks', status:nbs.status, body:nbsJson }, nbs.status);

    let nb = nbsJson.value.find(n => n.displayName === DEFAULT_NOTEBOOK_NAME);
    if (!nb) {
      const created = await fetch(`https://graph.microsoft.com/v1.0/me/onenote/notebooks`, {
        method:'POST',
        headers: { Authorization:`Bearer ${access}`, 'Content-Type':'application/json' },
        body: JSON.stringify({ displayName: DEFAULT_NOTEBOOK_NAME }),
      });
      const cjson = await created.json();
      if (!created.ok) return json({ ok:false, stage:'create-notebook', status:created.status, body:cjson }, created.status);
      nb = cjson;
    }

    // 2) Section
    const secs = await fetch(`https://graph.microsoft.com/v1.0/me/onenote/notebooks/${nb.id}/sections?$select=id,displayName`, {
      headers: { Authorization: `Bearer ${access}` }, cache:'no-store'
    });
    const secsJson = await secs.json();
    if (!secs.ok) return json({ ok:false, stage:'list-sections', status:secs.status, body:secsJson }, secs.status);

    let sec = secsJson.value.find(s => s.displayName === DEFAULT_SECTION_NAME);
    if (!sec) {
      const created = await fetch(`https://graph.microsoft.com/v1.0/me/onenote/notebooks/${nb.id}/sections`, {
        method:'POST',
        headers: { Authorization:`Bearer ${access}`, 'Content-Type':'application/json' },
        body: JSON.stringify({ displayName: DEFAULT_SECTION_NAME }),
      });
      const cjson = await created.json();
      if (!created.ok) return json({ ok:false, stage:'create-section', status:created.status, body:cjson }, created.status);
      sec = cjson;
    }

    // 3) Today’s page (create if missing)
    const ymd = todayYMD();
    const pages = await fetch(`https://graph.microsoft.com/v1.0/me/onenote/sections/${sec.id}/pages?$select=id,title,createdDateTime&top=50`, {
      headers: { Authorization:`Bearer ${access}` }, cache:'no-store'
    });
    const pagesJson = await pages.json();
    if (!pages.ok) return json({ ok:false, stage:'list-pages', status:pages.status, body:pagesJson }, pages.status);

    const expectedTitle = `Router — ${ymd}`;
    let page = pagesJson.value.find(p => p.title === expectedTitle);
    if (!page) {
      const html =
        `<!DOCTYPE html><html><head><title>${expectedTitle}</title><meta name="created" content="${new Date().toISOString()}"/></head>` +
        `<body><h1>${expectedTitle}</h1><p>Log started ${new Date().toLocaleString()}</p></body></html>`;
      const created = await fetch(`https://graph.microsoft.com/v1.0/me/onenote/sections/${sec.id}/pages`, {
        method:'POST',
        headers: { Authorization:`Bearer ${access}`, 'Content-Type':'text/html' },
        body: html,
      });
      const cjson = await created.json();
      if (!created.ok) return json({ ok:false, stage:'create-page', status:created.status, body:cjson }, created.status);
      page = cjson;
    }

    return json({
      ok: true,
      notebook: { id: nb.id, name: nb.displayName },
      section:  { id: sec.id, name: sec.displayName },
      page:     { id: page.id, title: page.title },
    });
  } catch (e) {
    return json({ ok:false, error: e.message || String(e) }, 500);
  }
}
