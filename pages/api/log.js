// /pages/api/log.js
//
// Purpose:
// - Accept free-form text + optional metadata from any chat
// - Classify (category → section route), build title + HTML, compute append strategy
// - Queue payload to KV for /api/cron/drain to post to OneNote
//
// Input (POST JSON):
// {
//   "text": "Ate chicken wrap (~520 kcal, 40g protein).",
//   "action": "queue" | "post",        // default: "queue"
//   "meta": { "calories": 520, "protein_g": 40, "tags": ["lunch"] },
//   "timestamp": "2025-09-18T12:34:00-04:00" // optional; else server time
// }
//
// Output (200):
// { "ok": true, "mode": "queued", "pageKey": "Food:2025-09", "dedupeKey": "<hash>" }
//
// Notes:
// - Tries to load a local KV wrapper first ('@/lib/kv'); if missing, falls back to '@vercel/kv'.
// - Tries to use '@/lib/classify' if present; otherwise uses a conservative built-in classifier.

import crypto from 'crypto';

async function getKV() {
  try {
    // Preferred: project wrapper (fixes earlier import drift)
    const mod = await import('@/lib/kv').catch(() => null);
    if (mod?.kv) return mod.kv;
  } catch (_) {}
  // Fallback: direct Vercel KV client
  const mod2 = await import('@vercel/kv').catch(() => null);
  if (!mod2?.kv) {
    throw new Error('KV client not found. Ensure either "@/lib/kv" exports { kv } or install @vercel/kv.');
  }
  return mod2.kv;
}

async function classify(text) {
  // Try project classifier first
  try {
    const mod = await import('@/lib/classify').catch(() => null);
    if (mod?.classifyAndFormat) {
      const res = await mod.classifyAndFormat(text);
      if (res) return res;
    }
  } catch (_) {}
  // Built-in conservative fallback
  const t = text.toLowerCase();
  const now = new Date();
  const iso = now.toISOString();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');

  // Very simple heuristics; project classifier will override when available
  let route = { notebookName: 'AliceChatGPT', sectionName: 'Journal' };
  let categoryLabel = 'NOTE';

  if (/(ate|meal|calorie|kcal|protein|yogurt|shake|breakfast|lunch|dinner)/.test(t)) {
    route = { notebookName: 'AliceChatGPT', sectionName: 'Food and Nutrition – Meals' };
    categoryLabel = 'MEAL';
  } else if (/(workout|gym|sets|reps|deadlift|squat|bench|run|steps|walk)/.test(t)) {
    route = { notebookName: 'AliceChatGPT', sectionName: 'Fitness' };
    categoryLabel = 'FIT';
  } else if (/(flight|hotel|itinerary|trip|travel)/.test(t)) {
    route = { notebookName: 'AliceChatGPT', sectionName: 'Travel' };
    categoryLabel = 'TRAVEL';
  } else if (/(budget|expense|salary|offer|interview|resume|finance)/.test(t)) {
    route = { notebookName: 'AliceChatGPT', sectionName: 'Finance and Career' };
    categoryLabel = 'FIN';
  } else if (/(wardrobe|shirt|pants|shoes|size|cart|buy|purchase|wishlist)/.test(t)) {
    route = { notebookName: 'AliceChatGPT', sectionName: 'Lifestyle and Wardrobe – Shopping List' };
    categoryLabel = 'WARDROBE';
  } else if (/(prime directive|ops|postmortem|runbook|router|onenote|probe|token)/.test(t)) {
    route = { notebookName: 'AliceChatGPT', sectionName: 'Prime Directive / Ops Notes' };
    categoryLabel = 'OPS';
  }

  const pageKey =
    route.sectionName.startsWith('Food and Nutrition') ? `Food:${yyyy}-${mm}` :
    route.sectionName === 'Fitness' ? `Fitness:${yyyy}-W${getISOWeekNumber(now)}` :
    route.sectionName === 'Journal' ? `Journal:${yyyy}-${mm}-${dd}` :
    route.sectionName === 'Travel' ? `Travel:${yyyy}-${mm}` :
    route.sectionName === 'Finance and Career' ? `Finance:${yyyy}-${mm}` :
    route.sectionName.startsWith('Lifestyle and Wardrobe') ? `Wardrobe:${yyyy}-${mm}` :
    route.sectionName.includes('Ops') ? `Ops:${yyyy}-${mm}-${dd}` :
    `General:${yyyy}-${mm}`;

  const title = `[${categoryLabel}] ${summarizeForTitle(text)} (${isoToLocal(iso)})`;

  const html = `
    <div>
      <h2>${escapeHtml(title)}</h2>
      <div data-ts="${iso}">
        <p>${escapeHtml(text)}</p>
      </div>
    </div>
  `.trim();

  return {
    route,
    title,
    html,
    ts: iso,
    appendTo: { pageKey },
  };
}

function getISOWeekNumber(date) {
  // ISO week number (1-53)
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Thursday in current week decides the year.
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function isoToLocal(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function escapeHtml(s) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function summarizeForTitle(text) {
  // crude single-line title; project classifier should produce richer titles
  const line = text.split('\n')[0].trim();
  return line.length > 80 ? `${line.slice(0, 77)}…` : line;
}

function stableHash(obj) {
  const json = typeof obj === 'string' ? obj : JSON.stringify(obj);
  return crypto.createHash('sha256').update(json).digest('hex').slice(0, 16);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const kv = await getKV();

    const body = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    const text = String(body.text || '').trim();
    const action = (body.action || 'queue').toLowerCase(); // 'queue' | 'post'
    const userTs = body.timestamp ? new Date(body.timestamp).toISOString() : null;

    if (!text) {
      return res.status(400).json({ ok: false, error: 'Missing "text"' });
    }

    const classified = await classify(text);

    // Allow caller-provided timestamp to override
    if (userTs) classified.ts = userTs;

    // Attach optional meta block
    if (body.meta && typeof body.meta === 'object') {
      // minimal merge — drain/poster can choose to render these fields
      classified.meta = body.meta;
      // calories/protein hints → tweak title if meal
      if (classified.route.sectionName.startsWith('Food and Nutrition') && (body.meta.calories || body.meta.protein_g)) {
        const kcal = body.meta.calories ? `${body.meta.calories} kcal` : null;
        const prot = body.meta.protein_g ? `${body.meta.protein_g}g protein` : null;
        const extras = [kcal, prot].filter(Boolean).join(', ');
        if (extras) {
          const noParens = classified.title.replace(/\s*\([^)]+\)\s*$/, '');
          classified.title = `${noParens} — ${extras} (${isoToLocal(classified.ts)})`;
        }
      }
    }

    // dedupeKey: content + day to prevent accidental duplicates on retries
    const dayKey = classified.ts.slice(0, 10);
    const dedupeKey = stableHash({ text, day: dayKey, pageKey: classified.appendTo?.pageKey, title: classified.title });
    classified.dedupeKey = dedupeKey;

    const envelope = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      action, // 'queue' or 'post'
      payload: classified,
      enqueuedAt: new Date().toISOString(),
      version: 1,
    };

    // Default path: queue (LPUSH keeps newest first)
    await kv.lpush('queue:v1', JSON.stringify(envelope));

    return res.status(200).json({
      ok: true,
      mode: 'queued',
      pageKey: classified.appendTo?.pageKey || null,
      dedupeKey,
      route: classified.route,
    });
  } catch (err) {
    console.error('log.js error:', err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
