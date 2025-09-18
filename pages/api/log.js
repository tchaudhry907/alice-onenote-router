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
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
}

// Simple classifier (lightweight, no AI)
function classify(text) {
  const lower = text.toLowerCase();
  if (/(ate|meal|calorie|protein|breakfast|lunch|dinner|snack|yogurt|shake)/.test(lower)) {
    return "Food and Nutrition – Meals";
  }
  if (/(beer|wine|whiskey|vodka|rum|cocktail|alcohol)/.test(lower)) {
    return "Food and Nutrition – Alcohol Notes";
  }
  if (/(workout|gym|run|lift|bench|squat|deadlift|steps|walk)/.test(lower)) {
    return "Fitness";
  }
  if (/(shirt|pants|jacket|shoes|shopping|cart|buy|wardrobe)/.test(lower)) {
    return "Lifestyle and Wardrobe – Shopping List";
  }
  if (/(budget|salary|finance|career|resume|job|offer)/.test(lower)) {
    return "Finance and Career";
  }
  if (/(journal|entry|thoughts|feeling|reflection)/.test(lower)) {
    return "Journal";
  }
  if (/(flight|hotel|trip|travel|itinerary|airport)/.test(lower)) {
    return "Travel";
  }
  return "Journal";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const body = req.body && typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
  const text = String(body.text || "").trim();
  if (!text) {
    return res.status(400).json({ error: "Missing text" });
  }

  const sectionName = classify(text);
  const sectionId = resolveSectionId(sectionName);
  if (!sectionId) {
    return res.status(400).json({ error: `Unknown section: ${sectionName}` });
  }

  const title = `[${sectionName}] ${text.slice(0, 50)}… (${nowLocal()})`;
  const html = `
    <html>
      <head>
        <title>${title}</title>
      </head>
      <body>
        <h2>${title}</h2>
        <p>${text}</p>
      </body>
    </html>
  `.trim();

  // Fast return — in your old setup this just routed without queueing
  return res.status(200).json({
    ok: true,
    route: { notebookName: NOTEBOOK_NAME, sectionName },
    title,
    html,
  });
}
