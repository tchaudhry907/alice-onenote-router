// pages/api/log.js
// Quick Log → auto-route to the right OneNote section (NoGraphListCalls).
// Routes: Steps, Workouts, Meals (incl. calories/food words), Alcohol notes,
// Wardrobe shopping, Finance & Career, Journal (explicit), Travel (booked/flight/hotel).

import { NOTEBOOK_NAME, resolveSectionId } from "@/lib/sections";

// Local time helper using USER_TZ (falls back to UTC safely)
function nowLocal() {
  const tz = process.env.USER_TZ || "UTC";
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    // Build YYYY-MM-DD HH:mm:ss
    const parts = Object.fromEntries(fmt.formatToParts(new Date()).map(p => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
  } catch {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  }
}

// Minimal internal helper to create a OneNote page through our own API
async function createOneNotePage({ sectionName, title, html }) {
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : ""; // in prod this resolves correctly; in preview/local, absolute URL not required
  const url = `${base}/api/onenote`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      act: "create",
      notebookName: NOTEBOOK_NAME,
      sectionName,
      title,
      html,
    }),
  });
  const data = await resp.json();
  if (!resp.ok || !data?.ok) {
    const error = data?.error || resp.statusText || "Create failed";
    throw new Error(error);
  }
  return data;
}

// ---------- Routing rules ----------
const numberLike = /(?:^|\D)(\d{2,})(?:\D|$)/;

const foodWords = [
  "ate", "meal", "breakfast", "lunch", "dinner", "snack", "calorie", "calories",
  "kcal", "latte", "coffee", "espresso", "tea", "sandwich", "salad", "bowl",
  "pizza", "burger", "fries", "rice", "chicken", "beef", "fish", "veggies",
  "vegetable", "fruit", "dessert", "cookie", "cake", "pasta", "noodles", "sushi",
];

const alcoholWords = ["whisky", "whiskey", "bourbon", "scotch", "wine", "beer", "tequila", "mezcal", "vodka", "gin", "tasting"];

const workoutWords = ["workout", "gym", "upper body", "lower body", "run", "ran", "ride", "cycling", "yoga", "lift", "strength", "cardio", "swim", "steps session"];

const stepWords = ["step", "steps", "walked"];

const wardrobeWords = ["buy", "need to buy", "shopping", "order", "belt", "socks", "shirt", "pants", "jacket", "shoes", "wardrobe", "closet"];

const financeWords = ["paid", "bill", "expense", "rent", "invoice", "salary", "transfer", "deposit", "bank", "credit", "debit", "investment", "options", "trading"];

const travelWords = ["booked", "flight", "hotel", "airbnb", "itinerary", "check-in", "check in", "boarding", "airport", "trip", "travel"];

function includesAny(text, words) {
  const t = text.toLowerCase();
  return words.some(w => t.includes(w));
}

function pickRoute(text) {
  const t = text.trim();

  // 0) Explicit journal intent
  if (/^\s*(journal|note)\s*[:\-–]/i.test(t)) {
    return { section: "Journal", kind: "journal" };
  }

  // 1) Steps: pref if contains step-words + a number
  if (includesAny(t, stepWords) && numberLike.test(t)) {
    const m = t.match(numberLike);
    const steps = m ? m[1] : null;
    return { section: "Fitness - Step Counts", kind: "steps", steps };
  }

  // 2) Workouts
  if (includesAny(t, workoutWords)) {
    return { section: "Fitness - Workouts", kind: "workout" };
  }

  // 3) Alcohol notes (before generic meals to keep tastings separate)
  if (includesAny(t, alcoholWords)) {
    return { section: "Food and Nutrition - Alcohol Notes", kind: "alcohol" };
  }

  // 4) Meals/food: calories OR food word routes here
  if (/\b(k?cal|calories?)\b/i.test(t) || includesAny(t, foodWords)) {
    return { section: "Food and Nutrition - Meals", kind: "meal" };
  }

  // 5) Wardrobe shopping
  if (includesAny(t, wardrobeWords)) {
    return { section: "Lifestyle and Wardrobe - Shopping List", kind: "wardrobe" };
  }

  // 6) Finance
  if (includesAny(t, financeWords)) {
    return { section: "Finance and Career", kind: "finance" };
  }

  // 7) Travel
  if (includesAny(t, travelWords)) {
    return { section: "Travel", kind: "travel" };
  }

  // 8) Fallback: top-level Food and Nutrition (general note)
  return { section: "Food and Nutrition", kind: "note" };
}

// ---------- API ----------
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }
    const { text } = req.body || {};
    if (!text || typeof text !== "string") {
      return res.status(400).json({ ok: false, error: "Missing text" });
    }

    const when = nowLocal();
    const route = pickRoute(text);
    const sectionName = route.section;

    // Titles/HTML by kind
    let title, html;

    switch (route.kind) {
      case "steps": {
        const n = route.steps || text.match(numberLike)?.[1] || "";
        title = `[STEPS] ${n} (${when})`;
        html = `<h2>${title}</h2><div><p>Steps: <b>${n}</b></p><p>Note: ${escapeHtml(text)}</p></div>`;
        break;
      }
      case "workout": {
        title = `[WORKOUT] ${text} (${when})`;
        html = `<h2>${title}</h2><div><p>Workout: <b>${escapeHtml(text)}</b></p></div>`;
        break;
      }
      case "alcohol": {
        title = `[ALCOHOL] ${text} (${when})`;
        html = `<h2>${title}</h2><div><p>${escapeHtml(text)}</p></div>`;
        break;
      }
      case "meal": {
        title = `[MEAL] ${text} (${when})`;
        html = `<h2>${title}</h2><div><p>${escapeHtml(text)}</p></div>`;
        break;
      }
      case "wardrobe": {
        title = `[WARDROBE] ${text} (${when})`;
        html = `<h2>${title}</h2><div><p>${escapeHtml(text)}</p></div>`;
        break;
      }
      case "finance": {
        title = `[FINANCE] ${text.replace(/\b(note|journal)\b[:\-–]?\s*/i, "")}`;
        html = `<h2>${title}</h2><div><p>${escapeHtml(text)}</p></div>`;
        break;
      }
      case "travel": {
        title = `[TRAVEL] ${text} (${when})`;
        html = `<h2>${title}</h2><div><p>${escapeHtml(text)}</p></div>`;
        break;
      }
      case "journal":
      default: {
        title = `[JOURNAL] ${text.replace(/^\s*(journal|note)\s*[:\-–]\s*/i, "")} (${when})`;
        html = `<h2>${title}</h2><div><p>${escapeHtml(text)}</p></div>`;
        break;
      }
    }

    // Create page
    const data = await createOneNotePage({
      sectionName,
      title,
      html,
    });

    return res.status(200).json({
      ok: true,
      routed: { sectionName, sectionId: resolveSectionId(sectionName), title, html },
      page: data.page,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err && err.message || err) });
  }
}

// tiny HTML escape
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
