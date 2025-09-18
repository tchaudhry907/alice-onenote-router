// pages/api/log.js
// Prime Directive logger: no Graph list calls, direct POST to known sections.

import { createPageInSection } from '@/lib/onenote'; // your existing helper that does the POST
import { nowStamp } from '@/lib/time';               // small util that returns "YYYY-MM-DD HH:MM:SS"

// ---- Known section names (resolved to IDs elsewhere; no list calls here) ----
// Keep names EXACTLY as your OneNote tabs show.
const SECTION_KEYS = {
  STEPS: "Fitness - Step Counts",
  WORKOUT: "Fitness - Workouts",
  MEAL: "Food and Nutrition",
  ALCOHOL: "Food and Nutrition - Alcohol Notes",
  INGREDIENTS: "Food and Nutrition - Ingredients",
  JOURNAL: "Journal",
  TRAVEL: "Travel",
  WARDROBE_SHOP: "Lifestyle and Wardrobe – Shopping List",
  WARDROBE_OUTFIT: "Lifestyle and Wardrobe – Closet and Outfits",
  FINANCE: "Finance and Career",
  FINANCE_PLANNING: "Finance and Career - Planning",
  OPTIONS: "Finance and Career – Options Trading",
  INBOX: "Inbox",
};

// ---------- ROUTER (ORDER MATTERS) ----------
function route(text) {
  const t = (text || '').toLowerCase();

  // Wardrobe – Shopping (must be BEFORE Ingredients)
  if (
    (/\b(buy|order|need|wishlist|cart|add to (the )?list|pickup)\b/.test(t)) &&
    /\b(belt|sock|shoe|sneaker|loafer|boot|tie|blazer|jacket|shirt|t[-\s]?shirt|tee|polo|jeans|pant|trouser|chino|dress|skirt|hat|cap|scarf|glove|hoodie|sweater|cardigan|coat)\b/.test(t)
  ) {
    return { sectionName: SECTION_KEYS.WARDROBE_SHOP, kind: 'wardrobe_shop' };
  }

  // Finance – Options
  if (/\b(options?|call|put|spreads?|iron condor|covered call|theta|delta|gamma)\b/.test(t)) {
    return { sectionName: SECTION_KEYS.OPTIONS, kind: 'options' };
  }

  // Finance – Planning
  if (/\b(401k|roth|ira|retire|retirement|plan(ning)?|allocation|savings goal|rebalance)\b/.test(t)) {
    return { sectionName: SECTION_KEYS.FINANCE_PLANNING, kind: 'finance_planning' };
  }

  // Finance – General (bills/expenses/income)
  if (/\b(pay(?:ment|check)?|paid|bill|billed|invoice|expense|spend|spent|budget|salary|bonus|tax|subscription|refund|charge(?:d)?)\b/.test(t)) {
    return { sectionName: SECTION_KEYS.FINANCE, kind: 'finance' };
  }

  // Steps
  if (/\b(\d{3,6})\s*steps?\b/.test(t) || /^steps?:?\s*\d+/.test(t)) {
    return { sectionName: SECTION_KEYS.STEPS, kind: 'steps' };
  }

  // Workout
  if (/(workout|gym|lift|ran|run|yoga|peloton|cycling|swim|upper body|lower body|cardio)/.test(t)) {
    return { sectionName: SECTION_KEYS.WORKOUT, kind: 'workout' };
  }

  // Alcohol
  if (/\b(whisky|whiskey|wine|beer|scotch|bourbon|tasting|gin|vodka|tequila|mezcal|rum|sake)\b/.test(t)) {
    return { sectionName: SECTION_KEYS.ALCOHOL, kind: 'alcohol' };
  }

  // Ingredients / Groceries (AFTER wardrobe shopping)
  if (/\b(ingredients?|grocer(?:y|ies)|shopping\s*list|add to (the )?list|need to buy|grocery|market)\b/.test(t)) {
    return { sectionName: SECTION_KEYS.INGREDIENTS, kind: 'ingredients' };
  }

  // Meals
  if (/^(meal|ate|breakfast|lunch|dinner|snack)\b/.test(t) || /\b(ate|cooked|ordered)\b/.test(t)) {
    return { sectionName: SECTION_KEYS.MEAL, kind: 'meal' };
  }

  // Journal
  if (/^(journal|diary|reflection|note:)\b/.test(t) || /\breflection\b/.test(t)) {
    return { sectionName: SECTION_KEYS.JOURNAL, kind: 'journal' };
  }

  // Travel
  if (/\b(flight|hotel|airbnb|booked|trip|visa|itinerary|airport|boarding pass|lounge)\b/.test(t)) {
    return { sectionName: SECTION_KEYS.TRAVEL, kind: 'travel' };
  }

  // Wardrobe – Outfits (general clothing mentions without “buy/need”)
  if (/\b(outfit|ootd|shirt|pants|jeans|jacket|dress|sneakers?|shoes|closet|wardrobe|look)\b/.test(t)) {
    return { sectionName: SECTION_KEYS.WARDROBE_OUTFIT, kind: 'wardrobe_outfit' };
  }

  return { sectionName: SECTION_KEYS.INBOX, kind: 'inbox' };
}

// ---------- HTML builders ----------
function htmlFor(kind, text, stamp) {
  const H = (title, body) => `<h2>${title}</h2>\n<div>${body}</div>`;
  switch (kind) {
    case 'steps': {
      const m = text.match(/\b(\d{3,6})\s*steps?\b/) || text.match(/steps?:?\s*(\d+)/i);
      const steps = m ? m[1] : '';
      return H(`[STEPS] ${steps} (${stamp})`, `<p>Steps: <b>${steps}</b></p><p>Note: ${escapeHtml(text)}</p>`);
    }
    case 'workout':
      return H(`[WORKOUT] ${escapeHtml(text)} (${stamp})`, `<p>Workout: <b>${escapeHtml(text)}</b></p>`);
    case 'meal':
      return H(`[MEAL] ${escapeHtml(text)} (${stamp})`, `<p>${escapeHtml(text)}</p>`);
    case 'alcohol':
      return H(`[ALCOHOL] ${escapeHtml(text)} (${stamp})`, `<p>${escapeHtml(text)}</p>`);
    case 'ingredients':
      return H(`[INGREDIENTS] ${escapeHtml(text)} (${stamp})`, `<p>${escapeHtml(text)}</p>`);
    case 'journal':
      return H(`[JOURNAL] ${escapeHtml(text.replace(/^journal:\s*/i,''))} (${stamp})`, `<p>${escapeHtml(text.replace(/^journal:\s*/i,''))}</p>`);
    case 'travel':
      return H(`[TRAVEL] ${escapeHtml(text)} (${stamp})`, `<p>${escapeHtml(text)}</p>`);
    case 'wardrobe_shop':
      return H(`[WARDROBE – SHOP] ${escapeHtml(text)} (${stamp})`, `<p>${escapeHtml(text)}</p>`);
    case 'wardrobe_outfit':
      return H(`[WARDROBE – OUTFIT] ${escapeHtml(text)} (${stamp})`, `<p>${escapeHtml(text)}</p>`);
    case 'finance':
      return H(`[FINANCE] ${escapeHtml(text)} (${stamp})`, `<p>${escapeHtml(text)}</p>`);
    case 'finance_planning':
      return H(`[FINANCE – PLANNING] ${escapeHtml(text)} (${stamp})`, `<p>${escapeHtml(text)}</p>`);
    case 'options':
      return H(`[OPTIONS] ${escapeHtml(text)} (${stamp})`, `<p>${escapeHtml(text)}</p>`);
    default:
      return H(`[NOTE] ${escapeHtml(text)} (${stamp})`, `<p>${escapeHtml(text)}</p>`);
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}

// ---------- API handler ----------
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    const { text } = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) || {};
    if (!text) return res.status(400).json({ ok: false, error: 'Missing text' });

    const stamp = nowStamp();
    const { sectionName, kind } = route(text);
    const title = htmlTitleFrom(kind, text, stamp);
    const html = htmlFor(kind, text, stamp);

    const page = await createPageInSection({ sectionName, title, html }); // posts directly, no list calls
    return res.status(200).json({ ok: true, routed: { sectionName, title, html }, page });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || String(e) });
  }
}

function htmlTitleFrom(kind, text, stamp) {
  switch (kind) {
    case 'steps': {
      const m = text.match(/\b(\d{3,6})\s*steps?\b/) || text.match(/steps?:?\s*(\d+)/i);
      const steps = m ? m[1] : text;
      return `[STEPS] ${steps} (${stamp})`;
    }
    case 'workout': return `[WORKOUT] ${text} (${stamp})`;
    case 'meal': return `[MEAL] ${text} (${stamp})`;
    case 'alcohol': return `[ALCOHOL] ${text} (${stamp})`;
    case 'ingredients': return `[INGREDIENTS] ${text} (${stamp})`;
    case 'journal': return `[JOURNAL] ${text.replace(/^journal:\s*/i,'')} (${stamp})`;
    case 'travel': return `[TRAVEL] ${text} (${stamp})`;
    case 'wardrobe_shop': return `[WARDROBE – SHOP] ${text} (${stamp})`;
    case 'wardrobe_outfit': return `[WARDROBE – OUTFIT] ${text} (${stamp})`;
    case 'finance': return `[FINANCE] ${text} (${stamp})`;
    case 'finance_planning': return `[FINANCE – PLANNING] ${text} (${stamp})`;
    case 'options': return `[OPTIONS] ${text} (${stamp})`;
    default: return `[NOTE] ${text} (${stamp})`;
  }
}
