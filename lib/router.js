// lib/router.js
// Classifies free text to { sectionName, title, html } using your Prime Directive.

import { resolveSectionId } from "@/lib/sections";

// Very simple detectors. Expand as needed.
function isSteps(text) {
  return /\b(step|steps)\b/i.test(text) && /\b\d{3,}\b/.test(text);
}
function extractSteps(text) {
  const m = text.match(/\b(\d{3,})\b/);
  return m ? Number(m[1]) : null;
}

function isWorkout(text) {
  return /\b(workout|gym|weights|run|cardio)\b/i.test(text);
}
function isMeal(text) {
  return /\b(ate|meal|breakfast|lunch|dinner|snack)\b/i.test(text);
}
function isAlcohol(text) {
  return /\b(whisky|whiskey|wine|beer|vodka|rum|tasting|scotch|bourbon)\b/i.test(text);
}
function isIngredients(text) {
  return /\b(need to buy|buy|shopping list|ingredients)\b/i.test(text);
}
function isJournal(text) {
  return /\b(journal:|diary:|reflection|note:)\b/i.test(text);
}
function isTravel(text) {
  return /\b(travel|flight|hotel|booked flight|itinerary|airport)\b/i.test(text);
}

// Title + HTML builders
function nowStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function routeText(textRaw) {
  const text = String(textRaw || "").trim();
  const now = nowStr();

  // STEPS
  if (isSteps(text)) {
    const steps = extractSteps(text) || text;
    const sectionName = "Fitness - Step Counts";
    const sectionId = resolveSectionId(sectionName);
    const title = `[STEPS] ${steps} (${now})`;
    const html = `<h2>${title}</h2><div><p>Steps: <b>${steps}</b></p><p>Note: ${text}</p></div>`;
    return { sectionName, sectionId, title, html };
  }

  // WORKOUT
  if (isWorkout(text)) {
    const sectionName = "Fitness - Workouts";
    const sectionId = resolveSectionId(sectionName);
    const title = `[WORKOUT] ${text} (${now})`;
    const html = `<h2>${title}</h2><div><p>Workout: <b>${text}</b></p></div>`;
    return { sectionName, sectionId, title, html };
  }

  // MEAL
  if (isMeal(text)) {
    const sectionName = "Food and Nutrition";
    const sectionId = resolveSectionId(sectionName);
    const title = `[MEAL] ${text} (${now})`;
    const html = `<h2>${title}</h2><div><p>${text}</p></div>`;
    return { sectionName, sectionId, title, html };
  }

  // ALCOHOL
  if (isAlcohol(text)) {
    const sectionName = "Food and Nutrition – Alcohol Notes";
    const sectionId = resolveSectionId(sectionName);
    const title = `[ALCOHOL] ${text} (${now})`;
    const html = `<h2>${title}</h2><div><p>${text}</p></div>`;
    return { sectionName, sectionId, title, html };
  }

  // INGREDIENTS / SHOPPING
  if (isIngredients(text)) {
    const sectionName = "Food and Nutrition – Ingredients";
    const sectionId = resolveSectionId(sectionName);
    const title = `[INGREDIENTS] ${text} (${now})`;
    const html = `<h2>${title}</h2><div><p>${text}</p></div>`;
    return { sectionName, sectionId, title, html };
  }

  // JOURNAL
  if (isJournal(text)) {
    const cleaned = text.replace(/^journal:\s*/i, "").replace(/^note:\s*/i, "");
    const sectionName = "Journal";
    const sectionId = resolveSectionId(sectionName);
    const title = `[JOURNAL] ${cleaned || text} (${now})`;
    const html = `<h2>${title}</h2><div><p>${cleaned || text}</p></div>`;
    return { sectionName, sectionId, title, html };
  }

  // TRAVEL
  if (isTravel(text)) {
    const sectionName = "Travel";
    const sectionId = resolveSectionId(sectionName);
    const title = `[TRAVEL] ${text} (${now})`;
    const html = `<h2>${title}</h2><div><p>${text}</p></div>`;
    return { sectionName, sectionId, title, html };
  }

  // Fallback → Food and Nutrition (your earlier rule used Inbox; we’ll keep it simple)
  const sectionName = "Food and Nutrition";
  const sectionId = resolveSectionId(sectionName);
  const title = `[NOTE] ${text} (${now})`;
  const html = `<h2>${title}</h2><div><p>${text}</p></div>`;
  return { sectionName, sectionId, title, html };
}
