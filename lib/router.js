// lib/router.js
import { NOTEBOOK_NAME, resolveSectionId } from "@/lib/sections.js";

const NAME = {
  STEPS: "Fitness – Step Counts",
  WORKOUTS: "Fitness – Workouts",
  FOOD: "Food and Nutrition",
  INGREDIENTS: "Food and Nutrition – Ingredients",
  ALCOHOL: "Food and Nutrition – Alcohol Notes",
  TRAVEL: "Travel",
  JOURNAL: "Journal",

  // New routes
  FINANCE_CAREER: "Finance & Career", // this may not have an ID yet — name fallback is fine
  WARDROBE_LIST: "Lifestyle and Wardrobe – Shopping List", // you already have an ID for this section
};

// Prefer sectionId (no list calls). If unknown, send the name (your create helper can handle it).
function pick(targetKey) {
  const sectionName = NAME[targetKey];
  const sectionId = resolveSectionId(sectionName);
  return sectionId ? { sectionId, sectionName } : { sectionName };
}

export function routeText(textRaw) {
  const text = String(textRaw || "").toLowerCase();

  // steps
  if (/\b\d{3,}\b/.test(text) && /\bstep(s)?\b/.test(text)) {
    const steps = (text.match(/\b\d{3,}\b/) || [])[0];
    return {
      ...pick("STEPS"),
      title: `[STEPS] ${steps}`,
      html: `<div><p>Steps: <b>${steps}</b></p><p>Note: ${escapeHtml(textRaw)}</p></div>`,
    };
  }

  // workouts
  if (/\b(workout|gym|lift|run|swim|yoga|cardio|legs|upper|lower)\b/.test(text)) {
    return {
      ...pick("WORKOUTS"),
      title: `[WORKOUT] ${textRaw}`,
      html: `<div><p>Workout: <b>${escapeHtml(textRaw)}</b></p></div>`,
    };
  }

  // wardrobe / shopping
  if (/\b(wardrobe|closet|outfit|shirt|pant|jean|belt|sock|shoe|sneaker|jacket|coat|tie|suit|dress|hoodie|sweater|buy|ordered?|purchase|return)\b/.test(text)) {
    return {
      ...pick("WARDROBE_LIST"),
      title: `[WARDROBE] ${textRaw}`,
      html: `<div><p>${escapeHtml(textRaw)}</p></div>`,
    };
  }

  // finance & career
  if (/\b(bill|billed|invoice|expense|paid|paycheck|salary|rent|tax|irs|credit|debit|loan|mortgage|finance|budget|reimbursement)\b/.test(text)) {
    return {
      ...pick("FINANCE_CAREER"),
      title: `[FINANCE] ${textRaw}`,
      html: `<div><p>${escapeHtml(textRaw)}</p></div>`,
    };
  }

  // alcohol notes
  if (/\b(whisky|whiskey|wine|beer|vodka|rum|tequila|bourbon|scotch|tasting|bar|lounge)\b/.test(text)) {
    return {
      ...pick("ALCOHOL"),
      title: `[ALCOHOL] ${textRaw}`,
      html: `<div><p>${escapeHtml(textRaw)}</p></div>`,
    };
  }

  // meals / food
  if (/\b(ate|meal|breakfast|lunch|dinner|snack|cooked|food|restaurant|pizza|salad|chicken|rice|pasta)\b/.test(text)) {
    return {
      ...pick("FOOD"),
      title: `[MEAL] ${textRaw}`,
      html: `<div><p>${escapeHtml(textRaw)}</p></div>`,
    };
  }

  // travel
  if (/\b(flight|fly|airport|hotel|airbnb|train|uber|lyft|trip|vacation|visa|passport|itinerary|booked)\b/.test(text)) {
    return {
      ...pick("TRAVEL"),
      title: `[TRAVEL] ${textRaw}`,
      html: `<div><p>${escapeHtml(textRaw)}</p></div>`,
    };
  }

  // default → journal
  return {
    ...pick("JOURNAL"),
    title: `[JOURNAL] ${textRaw}`,
    html: `<div><p>${escapeHtml(textRaw)}</p></div>`,
  };
}

export function notebookName() {
  return NOTEBOOK_NAME || "AliceChatGPT";
}

function escapeHtml(s) {
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}
