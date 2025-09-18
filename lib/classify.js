// lib/classify.js
// Ultra-light rules for routing text to a OneNote section + title prefix.

function includesAny(haystack, needles) {
  return needles.some(n => haystack.includes(n));
}

export function classifyText(input) {
  const t = String(input || '').trim();
  const lower = t.toLowerCase();

  // Fitness: steps
  if (includesAny(lower, [' step', 'steps', 'walked '])) {
    return { category: 'Fitness - Step Counts', titlePrefix: 'STEPS' };
  }

  // Fitness: workouts
  if (includesAny(lower, ['workout', 'gym', 'lift', 'deadlift', 'squat', 'bench'])) {
    return { category: 'Fitness - Workouts', titlePrefix: 'WORKOUT' };
  }

  // Food & meals
  if (includesAny(lower, ['ate ', 'breakfast', 'lunch', 'dinner', 'snack']) ||
      includesAny(lower, ['calorie', 'calories'])) {
    return { category: 'Food and Nutrition', titlePrefix: 'MEAL' };
  }

  // Alcohol notes
  if (includesAny(lower, ['whisky', 'whiskey', 'wine', 'beer', 'tequila', 'mezcal', 'bourbon'])) {
    return { category: 'Food and Nutrition – Alcohol Notes', titlePrefix: 'ALCOHOL' };
  }

  // Ingredients / grocery-like list
  if (includesAny(lower, ['ingredient', 'grocery', 'buy ', 'need to buy'])) {
    return { category: 'Food and Nutrition – Ingredients', titlePrefix: 'INGREDIENTS' };
  }

  // Finance
  if (includesAny(lower, ['paid ', 'expense', 'bill', 'invoice', 'salary', 'budget', 'option', 'stock'])) {
    return { category: 'Finance and Career', titlePrefix: 'FINANCE' };
  }

  // Wardrobe shopping
  if (includesAny(lower, ['wardrobe', 'outfit', 'closet', 'belt', 'socks', 'shoes'])) {
    return { category: 'Lifestyle and Wardrobe – Shopping List', titlePrefix: 'WARDROBE' };
  }

  // Travel
  if (includesAny(lower, ['flight', 'hotel', 'airbnb', 'train', 'airport', 'visa', 'itinerary', 'travel'])) {
    return { category: 'Travel', titlePrefix: 'TRAVEL' };
  }

  // Journal (fallback)
  return { category: 'Journal', titlePrefix: 'JOURNAL' };
}
