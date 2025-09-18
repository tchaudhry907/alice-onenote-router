// pages/api/log.js
// Natural-language router → OneNote page creation (NoGraphListCalls)
// Uses lib/sections.js for section IDs and posts to /api/onenote.

import { NOTEBOOK_NAME, resolveSectionId } from "@/lib/sections";

function nowStamp() {
  const pad = (n) => String(n).padStart(2, "0");
  const d = new Date();
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}

// Simple keyword routing. Order matters: most specific → general.
function routeText(textRaw) {
  const text = String(textRaw || "").trim();
  const lc = text.toLowerCase();

  // STEPS: "<number> steps"
  const stepsMatch = lc.match(/\b(\d{3,})\b(?=.*\bsteps?\b)/i);
  if (stepsMatch) {
    const steps = stepsMatch[1];
    const title = `[STEPS] ${steps} (${nowStamp()})`;
    return {
      sectionName: "Fitness - Step Counts",
      title,
      html: `<h2>${title}</h2><div><p>Steps: <b>${steps}</b></p><p>Note: ${escapeHtml(
        text
      )}</p></div>`,
    };
  }

  // WORKOUT
  if (
    /\b(workout|gym|upper body|lower body|deadlift|squat|bench|cardio|run|cycle|peloton)\b/i.test(
      lc
    )
  ) {
    const title = `[WORKOUT] ${text} (${nowStamp()})`;
    return {
      sectionName: "Fitness - Workouts",
      title,
      html: `<h2>${escapeHtml(title)}</h2><div><p>Workout: <b>${escapeHtml(
        text
      )}</b></p></div>`,
    };
  }

  // ALCOHOL notes
  if (/\b(whisky|whiskey|wine|beer|vodka|tequila|rum|tasting)\b/i.test(lc)) {
    const title = `[ALCOHOL] ${text} (${nowStamp()})`;
    return {
      sectionName: "Food and Nutrition - Alcohol Notes",
      title,
      html: `<h2>${escapeHtml(title)}</h2><div><p>${escapeHtml(text)}</p></div>`,
    };
  }

  // TRAVEL
  if (/\b(flight|airport|airline|hotel|itinerary|check-?in|checkin|booked)\b/i.test(lc)) {
    const title = `[TRAVEL] ${text} (${nowStamp()})`;
    return {
      sectionName: "Travel",
      title,
      html: `<h2>${escapeHtml(title)}</h2><div><p>${escapeHtml(text)}</p></div>`,
    };
  }

  // JOURNAL
  if (/^\s*journal\s*:/.test(lc) || /\breflection\b/i.test(lc)) {
    const clean = text.replace(/^\s*journal\s*:\s*/i, "");
    const title = `[JOURNAL] ${clean} (${nowStamp()})`;
    return {
      sectionName: "Journal",
      title,
      html: `<h2>${escapeHtml(title)}</h2><div><p>${escapeHtml(clean)}</p></div>`,
    };
  }

  // WARDROBE shopping (clothing words)
  if (
    /\b(belt|socks|shirt|t-?shirt|jeans|trousers|pants|shoes|sneakers|jacket|hoodie|coat|dress|skirt|tie|blazer|suit|wardrobe|closet)\b/i.test(
      lc
    ) &&
    /\b(buy|need to buy|shopping|order|purchase|pick up)\b/i.test(lc)
  ) {
    const title = `[WARDROBE] ${text} (${nowStamp()})`;
    return {
      sectionName: "Lifestyle and Wardrobe - Shopping List",
      title,
      html: `<h2>${escapeHtml(title)}</h2><div><p>${escapeHtml(text)}</p></div>`,
    };
  }

  // FOOD / MEAL
  if (/\b(ate|meal|breakfast|lunch|dinner|snack)\b/i.test(lc)) {
    const title = `[MEAL] ${text} (${nowStamp()})`;
    return {
      sectionName: "Food and Nutrition",
      title,
      html: `<h2>${escapeHtml(title)}</h2><div><p>${escapeHtml(text)}</p></div>`,
    };
  }

  // FINANCE & CAREER
  if (
    /\b(paid|pay|expense|bill|invoice|budget|rent|mortgage|salary|paycheck|deposit|transfer|bank|credit card|cc payment)\b/i.test(
      lc
    )
  ) {
    const title = `[FINANCE] ${text} (${nowStamp()})`;
    return {
      sectionName: "Finance and Career",
      title,
      html: `<h2>${escapeHtml(title)}</h2><div><p>${escapeHtml(text)}</p></div>`,
    };
  }

  // Default: plain note → Food and Nutrition
  const title = `[NOTE] ${text} (${nowStamp()})`;
  return {
    sectionName: "Food and Nutrition",
    title,
    html: `<h2>${escapeHtml(title)}</h2><div><p>${escapeHtml(text)}</p></div>`,
  };
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "Method Not Allowed" });
      return;
    }
    const { text } = (req.body || {});
    if (!text || typeof text !== "string") {
      res.status(400).json({ ok: false, error: "Provide JSON { text: string }" });
      return;
    }

    const routed = routeText(text);
    const sectionId = resolveSectionId(routed.sectionName);
    if (!sectionId) {
      res.status(400).json({
        ok: false,
        error: `Section not found in map: ${routed.sectionName}`,
        routed,
      });
      return;
    }

    // Self-call to /api/onenote (stays inside your deployment)
    const base =
      (req.headers["x-forwarded-proto"] ? `${req.headers["x-forwarded-proto"]}://` : "https://") +
      req.headers.host;

    const createResp = await fetch(`${base}/api/onenote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        act: "create",
        notebookName: NOTEBOOK_NAME,
        // use name instead of id — your /api/onenote resolves IDs via lib/sections
        sectionName: routed.sectionName,
        title: routed.title,
        html: routed.html,
      }),
    });

    const page = await createResp.json();
    if (!createResp.ok || page?.ok === false) {
      res.status(502).json({
        ok: false,
        error: page?.error || `Create page failed (${createResp.status})`,
        details: page,
        routed,
      });
      return;
    }

    res.status(200).json({ ok: true, routed, page: page.page || page });
  } catch (err) {
    res.status(500).json({ ok: false, error: (err && err.message) || String(err) });
  }
}
