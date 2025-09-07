// /pages/api/onenote/sections-in-notebook.js
// GET ?name=AliceChatGPT  -> { ok, notebookId, notebookName, sections:[{id,name}] }
// Caches the result in Redis for 6 hours.

import { kv } from "@/lib/kv";
import { exchangeRefreshToken, graphFetch } from "@/lib/msgraph";

export default async function handler(req, res) {
  try {
    const name = (req.query.name || "AliceChatGPT").toString();
    const cacheKey = `alice:notebook:${name}`;

    const cached = await kv.get(cacheKey);
    if (cached) return res.status(200).json({ ok: true, cached: true, ...cached });

    const savedRefresh = await kv.get("alice:cron:refresh");
    if (!savedRefresh) {
      return res.status(400).json({ ok: false, error: "Not bound. Visit /api/cron/bind while signed in." });
    }
    const { access_token } = await exchangeRefreshToken(savedRefresh);

    const url = "https://graph.microsoft.com/v1.0/me/onenote/notebooks?$top=200&$select=id,displayName&$expand=sections($select=id,displayName)";
    const r = await graphFetch(access_token, url);
    const t = await r.text();
    let j = null; try { j = JSON.parse(t); } catch {}
    if (!r.ok) return res.status(r.status).send(j || t);

    const list = Array.isArray(j.value) ? j.value : [];
    const nb = list.find(n => (n.displayName || "").trim().toLowerCase() === name.trim().toLowerCase());
    if (!nb) return res.status(404).json({ ok: false, error: `Notebook '${name}' not found` });

    const sections = Array.isArray(nb.sections) ? nb.sections.map(s => ({ id: s.id, name: s.displayName })) : [];
    const payload = { notebookId: nb.id, notebookName: nb.displayName, sections };

    await kv.set(cacheKey, payload, { ex: 60 * 60 * 6 });
    return res.status(200).json({ ok: true, cached: false, ...payload });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
