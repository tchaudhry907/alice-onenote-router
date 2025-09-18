// lib/intent-route.js
// Prime-Directive router: turn natural text into OneNote target + content.

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function routeAndFormat(inputRaw) {
  const input = (inputRaw || "").trim();
  const lower = input.toLowerCase();

  // ===== Fitness – Step Counts =====
  const stepsMatch = /\b(\d{3,6})\s*steps?\b|\bwalk(?:ed)?\s*(\d{3,6})\b/i.exec(input);
  if (lower.includes("steps") || stepsMatch) {
    const steps = (stepsMatch?.[1] || stepsMatch?.[2] || input.match(/\d{3,6}/)?.[0] || "0").replace(/[, ]/g, "");
    const title = `[STEPS] ${steps} (${nowStamp()})`;
    const html = `<p>Steps: <b>${steps}</b></p><p>Note: ${escapeHtml(input)}</p>`;
    return { sectionName: "Fitness - Step Counts", title, html };
  }

  // ===== Fitness – Workouts =====
  if (/\b(workout|gym|lift|run|cycle|bike|swim|yoga|upper body|lower body|cardio|hiit)\b/i.test(input)) {
    const title = `[WORKOUT] ${input} (${nowStamp()})`;
    const html = `<p>Workout: <b>${escapeHtml(input)}</b></p>`;
    return { sectionName: "Fitness - Workouts", title, html };
  }

  // ===== Food and Nutrition – Alcohol Notes =====
  if (/\b(whisky|whiskey|wine|beer|bourbon|tequila|mezcal|vodka|gin|rum|sake|scotch|tasting)\b/i.test(input)) {
    const title = `[ALCOHOL] ${input} (${nowStamp()})`;
    const html = `<p>${escapeHtml(input)}</p>`;
    return { sectionName: "Food and Nutrition – Alcohol Notes", title, html };
  }

  // ===== Food and Nutrition (Meals) =====
  if (/\b(ate|meal|breakfast|lunch|dinner|snack)\b/i.test(input) ||
      /\b(chicken|salad|rice|beef|egg|eggs|toast|sandwich|soup|bowl|pizza|pasta|veggies|oats|yogurt|fruit)\b/i.test(input)) {
    const title = `[MEAL] ${input} (${nowStamp()})`;
    const html = `<p>Meal: <b>${escapeHtml(input)}</b></p>`;
    return { sectionName: "Food and Nutrition", title, html };
  }

  // ===== Ingredients =====
  if (/\b(ingredient|grocery|buy|bought|purchase|stock up)\b/i.test(input)) {
    const title = `[INGREDIENTS] ${input} (${nowStamp()})`;
    const html = `<p>Ingredients: ${escapeHtml(input)}</p>`;
    return { sectionName: "Food and Nutrition – Ingredients", title, html };
  }

  // ===== Inbox (fallback) =====
  const title = `[INBOX] ${input.slice(0, 60)} (${nowStamp()})`;
  const html = `<p>${escapeHtml(input)}</p>`;
  return { sectionName: "Inbox", title, html };
}

function escapeHtml(s = "") {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
