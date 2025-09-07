// pages/api/onenote/append-test.js
// Full replacement. Minimal JSON-commands append to a given page (or today's page if none provided).

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
  const r = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    cache: 'no-store',
  });
  const j = await r.json();
  return j?.result ?? null;
}

function todayYMD(tz='America/New_York'){
  const now = new Date();
  const y = now.toLocaleString('en-CA', { timeZone: tz, year:'numeric' });
  const m = now.toLocaleString('en-CA', { timeZone: tz, month:'2-digit' });
  const d = now.toLocaleString('en-CA', { timeZone: tz, day:'2-digit' });
  return `${y}-${m}-${d}`;
}

async function ensureTargets(access) {
  // notebook
  let r = await fetch(`https://graph.microsoft.com/v1.0/me/onenote/notebooks?$select=id,displayName`, {
    headers: { Authorization: `Bearer ${access}` }, cache:'no-store'
  });
  let j = await r.json(); if (!r.ok) throw new Error(`list notebooks ${r.status}: ${JSON.stringify(j)}`);
  let nb = j.value.find(n => n.displayName === DEFAULT_NOTEBOOK_NAME);
  if (!nb) {
    r = await fetch(`https://graph.microsoft.com/v1.0/me/onenote/notebooks`, {
      method:'POST', headers:{ Authorization:`Bearer ${access}`, 'Content-Type':'application/json' },
      body: JSON.stringify({ displayName: DEFAULT_NOTEBOOK_NAME }),
    });
    j = await r.json(); if (!r.ok) throw new Error(`create notebook ${r.status}: ${JSON.stringify(j)}`);
    nb = j;
  }

  // section
  r = await fetch(`https://graph.microsoft.com/v1.0/me/onenote/notebooks/${nb.id}/sections?$select=id,displayName`, {
    headers:{ Authorization:`Bearer ${access}` }, cache:'no-store'
  });
  j = await r.json(); if (!r.ok) throw new Error(`list sections ${r.status}: ${JSON.stringify(j)}`);
  let sec = j.value.find(s => s.displayName === DEFAULT_SECTION_NAME);
  if (!sec) {
    r = await fetch(`https://graph.microsoft.com/v1.0/me/onenote/notebooks/${nb.id}/sections`, {
      method:'POST', headers:{ Authorization:`Bearer ${access}`, 'Content-Type':'application/json' },
      body: JSON.stringify({ displayName: DEFAULT_SECTION_NAME }),
    });
    j = await r.json(); if (!r.ok) throw new Error(`create section ${r.status}: ${JSON.stringify(j)}`);
    sec = j;
  }

  // page (today)
  const title = `Router — ${todayYMD()}`;
  r = await fetch(`https://graph.microsoft.com/v1.0/me/onenote/sections/${sec.id}/pages?$select=id,title,createdDateTime&top=50`, {
    headers:{ Authorization:`Bearer ${access}` }, cache:'no-store'
  });
  j = await r.json(); if (!r.ok) throw new Error(`list pages ${r.status}: ${JSON.stringify(j)}`);
  let page = j.value.find(p => p.title === title);
  if (!page) {
    const html = `<!DOCTYPE html><html><head><title>${title}</title></head><body><h1>${title}</h1></body></html>`;
    r = await fetch(`https://graph.microsoft.com/v1.0/me/onenote/sections/${sec.id}/pages`, {
      method:'POST', headers:{ Authorization:`Bearer ${access}`, 'Content-Type':'text/html' }, body: html
    });
    j = await r.json(); if (!r.ok) throw new Error(`create page ${r.status}: ${JSON.stringify(j)}`);
    page = j;
  }

  return { nb, sec, page };
}

export default async function handler(req) {
  try {
    const raw = await kvGet('msauth:default');
    if (!raw) return json({ ok:false, error:'No tokens in KV. Hit /api/auth/refresh in a signed-in browser.' }, 401);
    const tok = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const access = tok?.access;
    if (!access) return json({ ok:false, error:'KV missing access token' }, 401);

    const url = new URL(req.url);
    const qtext = url.searchParams.get('text');
    let bodyText = qtext;
    if (!bodyText && req.method === 'POST') {
      try { const posted = await req.json(); bodyText = posted?.text; } catch {}
    }
    if (!bodyText) bodyText = 'Append-test ping';

    const { nb, sec, page } = await ensureTargets(access);

    // JSON-commands append (what avoids 415)
    const safe = String(bodyText).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const commands = [
      { target:'body', action:'append', position:'after', content:`<p data-tag="p">${safe}</p>` }
    ];
    const r = await fetch(`https://graph.microsoft.com/v1.0/me/onenote/pages/${page.id}/content`, {
      method:'PATCH',
      headers:{ Authorization:`Bearer ${access}`, 'Content-Type':'application/json' },
      body: JSON.stringify(commands),
    });
    const txt = await r.text().catch(()=>'');

    if (!r.ok) return json({ ok:false, stage:'append', status:r.status, body:txt, page:page.id }, r.status);

    return json({ ok:true, appended: bodyText, notebook: nb.displayName, section: sec.displayName, page: { id: page.id, title: page.title } });
  } catch (e) {
    return json({ ok:false, error: e.message || String(e) }, 500);
  }
}

export const config = { api: { bodyParser: false } };
