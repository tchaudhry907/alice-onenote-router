// lib/router.js
//
// PRIME DIRECTIVE ROUTER
// Turns freeform text into { sectionName, title, html } for /api/onenote.
// Covers: Fitness (steps/workouts), Food (meals/ingredients/alcohol),
// Journal, Finance (general + options), Wardrobe (closet/outfits + shopping list),
// Travel, Story (ideas/scenes), and fallback Inbox.
//
// NOTE: Section names here are the **display names** in your OneNote:
//  - "Fitness - Step Counts"
//  - "Fitness - Workouts"
//  - "Food and Nutrition"
//  - "Food and Nutrition – Ingredients"  (en dash)
//  - "Food and Nutrition – Alcohol Notes" (en dash)
//  - "Journal"
//  - "Finance and Career"
//  - "Finance and Career – Options Trading" (en dash)
//  - "Lifestyle and Wardrobe – Closet and Outfits" (en dash)
//  - "Lifestyle and Wardrobe – Shopping List" (en dash)
//  - "Travel"
//  - "Story and Creative – Ideas" (en dash)
//  - "Story and Creative – Scenes" (en dash)
//  - "Inbox"
//
// If your notebook uses slightly different names, just change the strings below.

function nowStamp() {
  const pad = (n) => String(n).padStart(2, '0');
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const HH = pad(d.getHours());
  const MM = pad(d.getMinutes());
  const SS = pad(d.getSeconds());
  return `${yyyy}-${mm}-${dd} ${HH}:${MM}:${SS}`;
}

// Normalize punctuation: treat en dash/em dash like ASCII hyphen for comparisons.
function norm(s) {
  return (s || '')
    .replace(/[–—]/g, '-')         // dashes
    .replace(/\s+/g, ' ')          // collapse whitespace
    .trim()
    .toLowerCase();
}

// Build a simple HTML body with the raw text for context.
function htmlWrap(title, extra = '') {
  const safe = (s) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  return [
    `<h2>${safe(title)}</h2>`,
    extra ? `<div>${extra}</div>` : '',
  ].join('\n');
}

// Simple keyword helpers
function hasAny(str, words) {
  const s = ` ${norm(str)} `;
  return words.some((w) => s.includes(` ${norm(w)} `) || s.includes(` ${norm(w)}.`) || s.includes(` ${norm(w)},`));
}

export function routeText(inputText) {
  const text = (inputText || '').trim();
  const low = norm(text);
  const when = nowStamp();

  // ===== Fitness: Steps =====
  // e.g. "walked 10000 steps", "10,234 steps", "step count 12000"
  const stepsMatch = low.match(/\b(\d{2,})\s*(?:steps?|step count)\b/);
  if (stepsMatch || hasAny(low, ['walked steps', 'walk steps'])) {
    const steps = stepsMatch ? stepsMatch[1].replace(/,/g, '') : '';
    const title = steps
      ? `[STEPS] ${steps} (${when})`
      : `[STEPS] Logged steps (${when})`;
    const html = htmlWrap(title, `<p>Steps: <b>${steps || 'n/a'}</b></p><p>Note: ${text}</p>`);
    return { sectionName: 'Fitness - Step Counts', title, html };
  }

  // ===== Fitness: Workouts =====
  if (
    hasAny(low, [
      'workout', 'worked out', 'gym', 'lifting', 'upper body', 'lower body',
      'push day', 'pull day', 'legs', 'cardio', 'run', 'ran', 'swam', 'swim',
      'cycling', 'cycle', 'elliptical', 'treadmill', 'yoga', 'pilates'
    ])
  ) {
    const title = `[WORKOUT] ${text} (${when})`;
    const html = htmlWrap(title, `<p>Workout: <b>${text}</b></p>`);
    return { sectionName: 'Fitness - Workouts', title, html };
  }

  // ===== Food & Nutrition: Alcohol Notes =====
  if (hasAny(low, ['whisky', 'whiskey', 'bourbon', 'scotch', 'tequila', 'mezcal', 'wine', 'beer', 'cocktail', 'tasting'])) {
    const title = `[ALCOHOL] ${text} (${when})`;
    const html = htmlWrap(title, `<p>${text}</p>`);
    return { sectionName: 'Food and Nutrition – Alcohol Notes', title, html };
  }

  // ===== Food & Nutrition: Ingredients (shopping/stocking up) =====
  if (
    hasAny(low, [
      'grocery', 'groceries', 'ingredient', 'ingredients', 'restock', 'need to buy', 'buy more',
      'out of', 'ran out', 'shopping list', 'pickup milk', 'pick up milk'
    ])
  ) {
    const title = `[INGREDIENTS] ${text} (${when})`;
    const html = htmlWrap(title, `<p>${text}</p>`);
    return { sectionName: 'Food and Nutrition – Ingredients', title, html };
  }

  // ===== Food & Nutrition: Meals =====
  if (hasAny(low, ['ate', 'meal', 'breakfast', 'lunch', 'dinner', 'snack', 'ordered', 'cooked', 'food'])) {
    const title = `[MEAL] ${text} (${when})`;
    const html = htmlWrap(title, `<p>${text}</p>`);
    return { sectionName: 'Food and Nutrition', title, html };
  }

  // ===== Journal =====
  if (low.startsWith('journal:') || hasAny(low, ['journal', 'diary', 'reflection'])) {
    const clean = text.replace(/^journal:\s*/i, '');
    const title = `[JOURNAL] ${clean || text} (${when})`;
    const html = htmlWrap(title, `<p>${clean || text}</p>`);
    return { sectionName: 'Journal', title, html };
  }

  // ===== Finance: Options Trading =====
  if (
    hasAny(low, [
      'covered call', 'rolled', 'roll', 'buy to close', 'sell to open',
      'strike', 'premium', 'debit spread', 'credit spread', 'iron condor',
      'put', 'call', 'theta', 'gamma'
    ])
  ) {
    const title = `[OPTIONS] ${text} (${when})`;
    const html = htmlWrap(title, `<p>${text}</p>`);
    return { sectionName: 'Finance and Career – Options Trading', title, html };
  }

  // ===== Finance: General =====
  if (hasAny(low, ['budget', 'invoice', 'paid', 'paycheck', 'income', 'expense', 'stock', 'market', 'portfolio'])) {
    const title = `[FINANCE] ${text} (${when})`;
    const html = htmlWrap(title, `<p>${text}</p>`);
    return { sectionName: 'Finance and Career', title, html };
  }

  // ===== Wardrobe: Shopping List =====
  if (hasAny(low, ['need to buy', 'add to wardrobe list', 'shopping list', 'order clothes', 'buy shoes', 'buy shirt', 'buy pants'])) {
    const title = `[WARDROBE-LIST] ${text} (${when})`;
    const html = htmlWrap(title, `<p>${text}</p>`);
    return { sectionName: 'Lifestyle and Wardrobe – Shopping List', title, html };
  }

  // ===== Wardrobe: Closet & Outfits =====
  if (hasAny(low, ['outfit', 'wearing', 'wore', 'fit check', 'closet', 'look'])) {
    const title = `[OUTFIT] ${text} (${when})`;
    const html = htmlWrap(title, `<p>${text}</p>`);
    return { sectionName: 'Lifestyle and Wardrobe – Closet and Outfits', title, html };
  }

  // ===== Travel =====
  if (hasAny(low, ['flight', 'hotel', 'itinerary', 'booked flight', 'booked hotel', 'airport', 'airline', 'boarding'])) {
    const title = `[TRAVEL] ${text} (${when})`;
    const html = htmlWrap(title, `<p>${text}</p>`);
    return { sectionName: 'Travel', title, html };
  }

  // ===== Story & Creative =====
  if (low.startsWith('story:') || low.startsWith('scene:') || hasAny(low, ['story idea', 'scene idea', 'chapter'])) {
    const isScene = low.startsWith('scene:') || hasAny(low, ['scene']);
    const clean = text.replace(/^(story:|scene:)\s*/i, '');
    const title = isScene ? `[SCENE] ${clean} (${when})` : `[STORY] ${clean} (${when})`;
    const sectionName = isScene ? 'Story and Creative – Scenes' : 'Story and Creative – Ideas';
    const html = htmlWrap(title, `<p>${clean}</p>`);
    return { sectionName, title, html };
  }

  // ===== Fallback: Inbox =====
  const title = `[INBOX] ${text} (${when})`;
  const html = htmlWrap(title, `<p>${text}</p>`);
  return { sectionName: 'Inbox', title, html };
}
