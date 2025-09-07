// /lib/indexer.js
// Lightweight text index helpers stored in Redis.

import { redis } from '@/lib/kv';

/**
 * Save the notebooks+sections “catalog” (what /cache-index fetches).
 */
export async function saveNotebookIndex(obj) {
  // Store the raw object for browsing/searching sections
  await redis.set('onenote:index', JSON.stringify(obj), 60 * 60);
}

/**
 * Append plain text into a per-day bucket (used by daily log) AND a flat “pages” index.
 * pageId: Graph page id
 * text: plain string
 * meta: { title?, sectionId?, notebook?, ts? }
 */
export async function indexPageText(pageId, text, meta = {}) {
  if (!pageId) return;

  const ts = meta.ts || Date.now();
  const day = new Date(ts).toISOString().slice(0, 10); // YYYY-MM-DD

  // 1) Per-day list
  const dayKey = `idx:day:${day}`;
  await redis.rpush(dayKey, JSON.stringify({ pageId, text, meta }));
  await redis.expire(dayKey, 60 * 60 * 24 * 45); // keep 45 days (tweak as you like)

  // 2) Flat append-only log
  const flatKey = 'idx:pages';
  await redis.rpush(flatKey, JSON.stringify({ pageId, text, meta }));
  // (optionally cap this list in the future)
}

/**
 * Query the flat index for a substring (case-insensitive). This is simple and fast to wire.
 */
export async function searchIndexedText(q, limit = 20) {
  const raw = await redis.lrange('idx:pages', 0, -1);
  if (!raw || raw.length === 0) return [];

  const term = q.toLowerCase();
  const out = [];
  for (const s of raw) {
    try {
      const row = typeof s === 'string' ? JSON.parse(s) : s;
      const hay = `${row?.text || ''} ${(row?.meta?.title || '')}`.toLowerCase();
      if (hay.includes(term)) {
        out.push(row);
        if (out.length >= limit) break;
      }
    } catch {
      // ignore bad rows
    }
  }
  return out;
}
