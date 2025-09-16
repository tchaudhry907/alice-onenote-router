// pages/api/graph/sections-create-batch.js

import { getAccessToken } from '@/lib/auth';

async function resolveToken(req, res) {
  const auth = req.headers?.authorization || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (m && m[1]) return m[1];
  const t = await getAccessToken(req, res);
  return t || null;
}

async function graphGET(path, token) {
  const r = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!r.ok) throw new Error(`graphGET ${path} -> ${r.status}: ${await r.text().catch(()=> '')}`);
  return r.json();
}

async function graphPOST(path, body, token) {
  const r = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`graphPOST ${path} -> ${r.status}: ${await r.text().catch(()=> '')}`);
  return r.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const token = await resolveToken(req, res);
    if (!token) return res.status(401).json({ error: 'No access token' });

    const { notebookName, notebookId, sectionNames = [] } = req.body || {};
    if ((!notebookName && !notebookId) || !Array.isArray(sectionNames) || sectionNames.length === 0) {
      return res.status(400).json({ error: 'notebookName or notebookId, and sectionNames[] are required' });
    }

    let nbId = notebookId;
    if (!nbId) {
      const nbRes = await graphGET(`/me/onenote/notebooks?$select=id,displayName`, token);
      const notebooks = nbRes.value || nbRes.notebooks || [];
      const nb = notebooks.find(
        (n) => (n.displayName || n.name || '').toLowerCase() === String(notebookName || '').toLowerCase()
      );
      if (!nb) return res.status(404).json({ error: `Notebook not found: ${notebookName}` });
      nbId = nb.id;
    }

    const created = [];
    for (const name of sectionNames) {
      // Try existing
      const secRes = await graphGET(`/me/onenote/notebooks/${nbId}/sections?$select=id,displayName`, token);
      const secs = secRes.value || secRes.sections || [];
      const existing = secs.find((s) => (s.displayName || s.name || '').toLowerCase() === String(name).toLowerCase());
      if (existing) {
        created.push({ name, id: existing.id, existed: true });
        continue;
      }
      const newSec = await graphPOST(`/me/onenote/notebooks/${nbId}/sections`, { displayName: name }, token);
      created.push({ name, id: newSec?.id || null, existed: false });
    }

    return res.status(200).json({ ok: true, notebookId: nbId, created });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
