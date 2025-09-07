// /lib/indexer.js
// Lightweight server-side cache + search for OneNote page text.
// Backed by Upstash Redis via '@/lib/kv'.

import { redis } from '@/lib/kv';

// Redis keys / namespaces
const PAGES_SET = 'alice:index:pages'; // set of pageIds we have cached
const PAGE_JSON = (id) => `alice:page:${id}:json`; // JSON blob with text/title/meta

/**
 * Save page text + metadata to Redis and add to the index set.
 * Expected to be called by upload/log endpoints right after creating/fetching a page.
 *
 * @param {Object} info
 * @param {string} info.pageId - OneNote page id
 * @param {string} [info.title]
 * @param {string} [info.text] - plain text content
 * @param {string} [info.notebookId]
 * @param {string} [info.sectionId]
 * @param {string} [info.createdDateTime] - ISO string
 * @param {Object} [info.links] - { oneNoteWebUrl: { href }, oneNoteClientUrl: { href } }
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
    text,                 // original text
    textLower: (text || '').toLowerCase(), // for simple substring search
    notebookId,
    sectionId,
    createdDateTime,
    links,
    updatedAt: new Date().toISOString(),
  };

  // Store JSON and add to set
  await Promise.all([
    redis.set(PAGE_JSON(pageId), JSON.stringify(payload)),
    redis.sadd(PAGES_SET, pageId),
  ]);

  return { ok: true, pageId };
}

/**
 * Return cached plain text for a page (or null if not cached).
 * @param {string} pageId
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
 * Simple substring search over cached pages in Redis.
 * For large indexes, replace with an inverted index. For now this is fine.
 *
 * @param {string} q - search query
 * @param {Object} [opts]
 * @param {number} [opts.limit=10]
 * @param {string} [opts.notebookId] - optional filter
 * @param {string} [opts.sectionId]  - optional filter
 */
export async function searchCached(q, opts = {}) {
  const { limit = 10, notebookId, sectionId } = opts;
  const query = (q || '').trim().toLowerCase();
  if (!query) return { ok: true, total: 0, results: [] };

  // Get all pageIds we’ve cached
  const pageIds = await redis.smembers(PAGES_SET);
  if (!pageIds || pageIds.length === 0) return { ok: true, total: 0, results: [] };

  // Fetch page JSON blobs in batches to avoid large payloads
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

      // Optional notebook/section filters
      if (notebookId && obj.notebookId !== notebookId) continue;
      if (sectionId && obj.sectionId !== sectionId) continue;

      const idx = obj.textLower.indexOf(query);
      if (idx >= 0) {
        // Build a small snippet around the first match
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
