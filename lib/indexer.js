// lib/indexer.js
// Lightweight Redis-backed index + cache for OneNote page text.
// Works with Upstash Redis via '@/lib/kv'.

import { kv } from '@/lib/kv';

// Key helpers
const PAGES_SET = 'alice:index:pages';
const PAGE_JSON = (id) => `alice:page:${id}:json`;
const NB_SECTIONS = (nbId) => `alice:notebook:${nbId}:sections`;

export async function indexPage(info = {}) {
  const {
    pageId,
    title = '',
    text = '',
    notebookId = '',
    sectionId = '',
    createdDateTime = new Date().toISOString(),
    links = {},
  } = info;

  if (!pageId) throw new Error('indexPage: pageId required');

  const payload = {
    pageId,
    title,
    text,
    textLower: (text || '').toLowerCase(),
    notebookId,
    sectionId,
    createdDateTime,
    links,
    updatedAt: new Date().toISOString(),
  };

  await kv.set(PAGE_JSON(pageId), payload);

  const pageIds = (await kv.get(PAGES_SET)) || [];
  if (!pageIds.includes(pageId)) {
    pageIds.push(pageId);
    await kv.set(PAGES_SET, pageIds);
  }

  return { ok: true, pageId };
}

export async function getCachedText(pageId) {
  if (!pageId) return null;
  const obj = await kv.get(PAGE_JSON(pageId));
  return obj?.text ?? null;
}

export async function searchCached(q, opts = {}) {
  const { limit = 10, notebookId, sectionId } = opts;
  const query = (q || '').trim().toLowerCase();
  if (!query) return { ok: true, total: 0, results: [] };

  const pageIds = await kv.get(PAGES_SET) || [];
  const results = [];

  for (const pageId of pageIds) {
    const obj = await kv.get(PAGE_JSON(pageId));
    if (!obj?.textLower) continue;

    if (notebookId && obj.notebookId !== notebookId) continue;
    if (sectionId && obj.sectionId !== sectionId) continue;

    const idx = obj.textLower.indexOf(query);
    if (idx >= 0) {
      const start = Math.max(0, idx - 40);
      const end = Math.min(obj.text.length, idx + query.length + 40);
      const snippet = obj.text.slice(start, end).replace(/\\s+/g, ' ').trim();

      results.push({
        pageId: obj.pageId,
        title: obj.title,
        notebookId: obj.notebookId,
        sectionId: obj.sectionId,
        createdDateTime: obj.createdDateTime,
        links: obj.links,
        snippet,
      });
      if (results.length >= limit) break;
    }
  }

  return { ok: true, total: results.length, results };
}

export async function saveNotebookIndex({ notebookId, sections = [] } = {}) {
  if (!notebookId) throw new Error('saveNotebookIndex: notebookId required');
  await kv.set(NB_SECTIONS(notebookId), sections);
  return { ok: true, notebookId, count: sections.length };
}

export async function getNotebookIndex(notebookId) {
  if (!notebookId) return null;
  return await kv.get(NB_SECTIONS(notebookId));
}

export async function searchIndexedText(q, opts = {}) {
  return searchCached(q, opts);
}
