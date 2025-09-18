// pages/api/cleanup.js
// DELETE pages whose title contains a query string, optionally limited to a section.
import { kv } from "@vercel/kv";

async function getToken() { return await kv.get("graph:access_token"); }

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const { contains, sectionId } = req.body || {};
  if (!contains) return res.status(400).json({ ok: false, error: "Missing 'contains' string" });

  const token = await getToken();
  if (!token) return res.status(400).json({ ok: false, error: "No Graph access token in KV" });

  const filter = encodeURIComponent(`contains(title,'${contains.replace(/'/g, "''")}')`);
  const base = sectionId
    ? `https://graph.microsoft.com/v1.0/me/onenote/sections/${encodeURIComponent(sectionId)}/pages`
    : `https://graph.microsoft.com/v1.0/me/onenote/pages`;

  const found = [];
  let url = `${base}?$select=id,title&$top=100&$filter=${filter}`;
  while (url) {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json();
    (j.value || []).forEach(p => found.push({ id: p.id, title: p.title }));
    url = j['@odata.nextLink'] || null;
  }

  const deleted = [];
  for (const p of found) {
    const del = await fetch(`https://graph.microsoft.com/v1.0/me/onenote/pages/${encodeURIComponent(p.id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (del.status === 204) deleted.push(p);
  }

  res.json({ ok: true, contains, sectionId: sectionId || null, deletedCount: deleted.length, deleted });
}
