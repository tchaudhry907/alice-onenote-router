// /lib/indexer.js
// Lightweight Redis-backed index + cache for OneNote page text.
// Works with Upstash Redis via '@/lib/kv' and provides all exports
// your API routes expect.

import { redis } from '@/lib/kv';

// Key helpers
const PAGES_SET = 'alice:index:pages';                 // set of pageIds we cached
const PAGE_JSON = (id) => `alice:page:${id}:json`;     // JSON blob per page
const NB_SECTIONS = (nbId) => `alice:notebook:${nbId}:sections`; // cached sections list JSON

/**
 * Save page text + metadata to Redis and add to index set.
 * Called after creating or fetching a page’s content.
 */
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

  await Promise.all([
    redis.set(PAGE_JSON(pageId), JSON.stringify(payload)),
    redis.sadd(PAGES_SET, pageId),
  ]);

  return { ok: true, pageId };
}

/**
 * Return cached plain text for a page (or null).
 */
export async function getCachedText(pageId) {
  if (!pageId) return null;
  const raw = await redis.get(PAGE_JSON(pageId));
  if (!raw) return null;
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return obj?.text ?? null;
  } catch {
    return null;
  }
}

/**
 * Simple substring search over cached pages.
 * For large data, replace with a real inverted index.
 */
export async function searchCached(q, opts = {}) {
  const { limit = 10, notebookId, sectionId } = opts;
  const query = (q || '').trim().toLowerCase();
  if (!query) return { ok: true, total: 0, results: [] };

  const pageIds = await redis.smembers(PAGES_SET);
  if (!pageIds || pageIds.length === 0) return { ok: true, total: 0, results: [] };

  const batchSize = 50;
  const results = [];
  for (let i = 0; i < pageIds.length; i += batchSize) {
    const batchIds = pageIds.slice(i, i + batchSize);
    const keys = batchIds.map(PAGE_JSON);
    const values = await redis.mget(...keys);
    for (let j = 0; j < values.length; j++) {
      const v = values[j];
      if (!v) continue;
      let obj;
      try {
        obj = typeof v === 'string' ? JSON.parse(v) : v;
      } catch {
        continue;
      }
      if (!obj?.textLower) continue;

      if (notebookId && obj.notebookId !== notebookId) continue;
      if (sectionId && obj.sectionId !== sectionId) continue;

      const idx = obj.textLower.indexOf(query);
      if (idx >= 0) {
        const start = Math.max(0, idx - 40);
        const end = Math.min(obj.text.length, idx + query.length + 40);
        const snippet = obj.text.slice(start, end).replace(/\s+/g, ' ').trim();

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
    if (results.length >= limit) break;
  }

  return { ok: true, total: results.length, results };
}

/**
 * Save a notebook’s section index to Redis (JSON array of sections).
 * Routes may call this after fetching sections from Graph.
 */
export async function saveNotebookIndex({ notebookId, sections = [] } = {}) {
  if (!notebookId) throw new Error('saveNotebookIndex: notebookId required');
  await redis.set(NB_SECTIONS(notebookId), JSON.stringify(sections));
  return { ok: true, notebookId, count: sections.length };
}

/**
 * Get a notebook’s section index from Redis (or null if not present).
 */
export async function getNotebookIndex(notebookId) {
  if (!notebookId) return null;
  const raw = await redis.get(NB_SECTIONS(notebookId));
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

/**
 * Back-compat shim: some routes import searchIndexedText().
 * Map it to our searchCached().
 */
export async function searchIndexedText(q, opts = {}) {
  return searchCached(q, opts);
}
