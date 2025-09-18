// pages/api/log.js
// Prime-Directive logger: route one sentence into the right OneNote section (no Graph list calls)

import { createOneNotePageBySectionId } from "@/lib/msgraph";

// --- Known Notebook & Section IDs (from your snapshot) ----------------------
// Notebook: AliceChatGPT (you already have these IDs working in prior calls)

const SECTIONS = {
  // Fitness
  "Fitness – Workouts": "sdf1317aee7204806ba48d430f339c923",
  "Fitness - Workouts": "sdf1317aee7204806ba48d430f339c923",
  "Fitness – Step Counts": "s240c71270b6d4341bd64a665275d85a4",
  "Fitness - Step Counts": "s240c71270b6d4341bd64a665275d85a4",
  "Fitness – Progress": "sa2eb24e412144523b6fe90e97edaadf1",
  "Fitness - Progress": "sa2eb24e412144523b6fe90e97edaadf1",

  // Food & Nutrition
  "Food and Nutrition": "s8dd162a74531444eaee1b88c96c56d7c",
  "Food and Nutrition – Meals": "s99db9d2afe324f7e89479d7d84cde5dd",
  "Food and Nutrition - Meals": "s99db9d2afe324f7e89479d7d84cde5dd",
  "Food and Nutrition – Ingredients": "sec12c41ac704440ebac7daeb6ead26c1",
  "Food and Nutrition - Ingredients": "sec12c41ac704440ebac7daeb6ead26c1",
  "Food and Nutrition – Alcohol Notes": "s3c1c6233ad714675a45af9359aba1e80",
  "Food and Nutrition - Alcohol Notes": "s3c1c6233ad714675a45af9359aba1e80",

  // Journal
  "Journal": "s0d93ba4b9abf4f3da1f053ddaddb2435",

  // Travel
  "Travel": "sb2f5ccb5c6fd456480ec45d90a716dfb",

  // Finance & Career
  "Finance and Career": "s8940df4070894d42863587ceeb4ccd9f",
  "Finance and Career – Planning": "s0ec4b00bd0184bdc95a764df7e5ad18d",
  "Finance and Career - Planning": "s0ec4b00bd0184bdc95a764df7e5ad18d",
  "Finance and Career – Options Trading": "sad257e1baeb44a5bb70616be701f16b1",
  "Finance and Career - Options Trading": "sad257e1baeb44a5bb70616be701f16b1",

  // Lifestyle & Wardrobe
  "Lifestyle and Wardrobe": "s3209996b27a043a299f0f6ebe5f75b81",
  "Lifestyle and Wardrobe – Closet and Outfits": "s095cf17274d54357917311cc8ab47daf",
  "Lifestyle and Wardrobe - Closet and Outfits": "s095cf17274d54357917311cc8ab47daf",
  "Lifestyle and Wardrobe – Shopping List": "s66518a6fd3744884af8078f2d1d61e3b",
  "Lifestyle and Wardrobe - Shopping List": "s66518a6fd3744884af8078f2d1d61e3b",

  // Story & Creative
  "Story and Creative": "s06787102dfa049de9b393fe4b7fd62d0",
  "Story and Creative – Ideas": "sb12faa8a8e7542b18eb58be3700263e8",
  "Story and Creative - Ideas": "sb12faa8a8e7542b18eb58be3700263e8",
  "Story and Creative – Scenes": "s1f51f6135fde4559960e5fc13735fa2c",
  "Story and Creative - Scenes": "s1f51f6135fde4559960e5fc13735fa2c",
  "Story and Creative – Time Wound Saga": "s0101cab76b0147ab8ce897685e91db4b",
  "Story and Creative - Time Wound Saga": "s0101cab76b0147ab8ce897685e91db4b",

  // Inbox (fallback)
  "Inbox": "scfd7de0686df4aa1bc663dd4e7769585",
};

// --- Simple router rules (keyword → section key) ----------------------------

function route(text) {
  const t = (text || "").toLowerCase();

  // Fitness: steps
  if (/\b(\d{3,6})\s*steps?\b/.test(t) || /^steps?:?\s*\d+/.test(t)) {
    return { sectionKey: "Fitness - Step Counts", kind: "steps" };
  }

  // Fitness: workout / gym
  if (/(workout|gym|lift|ran|run|yoga|peloton|cycling|swim|upper body|lower body|cardio)/.test(t)) {
    return { sectionKey: "Fitness - Workouts", kind: "workout" };
  }

  // Food: meals
  if (/^(meal|ate|breakfast|lunch|dinner|snack)\b/.test(t) || /\b(ate|cooked|ordered)\b/.test(t)) {
    return { sectionKey: "Food and Nutrition", kind: "meal" };
  }

  // Food: alcohol
  if (/\b(whisky|whiskey|wine|beer|scotch|bourbon|tasting|gin|vodka|tequila|mezcal|rum|sake)\b/.test(t)) {
    return { sectionKey: "Food and Nutrition - Alcohol Notes", kind: "alcohol" };
  }

  // Food: ingredients / groceries
  if (/\b(ingredients?|grocer(y|ies)|shopping\s*list|need to buy|add to list)\b/.test(t)) {
    return { sectionKey: "Food and Nutrition - Ingredients", kind: "ingredients" };
  }

  // Journal
  if (/^(journal|diary|reflection|thought|today|note:)/.test(t) || /\breflection\b/.test(t)) {
    return { sectionKey: "Journal", kind: "journal" };
  }

  // Travel
  if (/\b(flight|hotel|airbnb|booked|trip|visa|itinerary|airport|boarding pass)\b/.test(t)) {
    return { sectionKey: "Travel", kind: "travel" };
  }

  // Finance (general)
  if (/\b(paycheck|budget|expense|invoice|salary|bonus|tax|bill|subscription|rebalance)\b/.test(t)) {
    return { sectionKey: "Finance and Career", kind: "finance" };
  }

  // Finance – Planning
  if (/\b(401k|roth|ira|retire|retirement|plan|planning|allocation|savings goal)\b/.test(t)) {
    return { sectionKey: "Finance and Career - Planning", kind: "finance_planning" };
  }

  // Finance – Options Trading
  if (/\b(options?|calls?|puts?|spreads?|iron condor|covered call|theta|delta|gamma)\b/.test(t)) {
    return { sectionKey: "Finance and Career – Options Trading", kind: "options" };
  }

  // Wardrobe – Closet & Outfits
  if (/\b(outfit|shirt|pants|jeans|jacket|dress|sneakers?|shoes|closet|wardrobe|OOTD)\b/.test(t)) {
    return { sectionKey: "Lifestyle and Wardrobe – Closet and Outfits", kind: "wardrobe_outfit" };
  }

  // Wardrobe – Shopping List
  if (/\b(buy|order|need|wishlist|cart)\b/.test(t) && /\b(belt|socks|tie|blazer|shirt|shoes|pants|jeans|hat|scarf)\b/.test(t)) {
    return { sectionKey: "Lifestyle and Wardrobe – Shopping List", kind: "wardrobe_shop" };
  }

  // Story & Creative – Ideas
  if (/\b(idea|plot|concept|hook|premise)\b/.test(t)) {
    return { sectionKey: "Story and Creative – Ideas", kind: "story_idea" };
  }

  // Story & Creative – Scenes
  if (/\b(scene|dialogue|beat|act|chapter)\b/.test(t)) {
    return { sectionKey: "Story and Creative – Scenes", kind: "story_scene" };
  }

  // Story & Creative – Time Wound Saga
  if (/\b(time wound|saga|tws)\b/.test(t)) {
    return { sectionKey: "Story and Creative – Time Wound Saga", kind: "story_tws" };
  }

  // Fallback
  return { sectionKey: "Inbox", kind: "inbox" };
}

// --- Helpers ----------------------------------------------------------------

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// Format title + html by kind
function formatEntry(kind, text) {
  const stamp = nowStamp();
  const clean = text.trim();

  if (kind === "steps") {
    const m = clean.match(/(\d{3,6})/);
    const steps = m ? m[1] : "0";
    const title = `[STEPS] ${steps} (${stamp})`;
    const html = `<h2>${escapeHtml(title)}</h2>\n<div><p>Steps: <b>${escapeHtml(steps)}</b></p><p>Note: ${escapeHtml(clean)}</p></div>`;
    return { title, html };
  }

  if (kind === "workout") {
    const title = `[WORKOUT] ${clean} (${stamp})`;
    const html = `<h2>${escapeHtml(title)}</h2>\n<div><p>Workout: <b>${escapeHtml(clean)}</b></p></div>`;
    return { title, html };
  }

  if (kind === "alcohol") {
    const title = `[ALCOHOL] ${clean} (${stamp})`;
    const html = `<h2>${escapeHtml(title)}</h2>\n<div><p>${escapeHtml(clean)}</p></div>`;
    return { title, html };
  }

  if (kind === "ingredients") {
    const title = `[INGREDIENTS] ${clean} (${stamp})`;
    const html = `<h2>${escapeHtml(title)}</h2>\n<div><p>${escapeHtml(clean)}</p></div>`;
    return { title, html };
  }

  if (kind === "meal") {
    const title = `[MEAL] ${clean} (${stamp})`;
    const html = `<h2>${escapeHtml(title)}</h2>\n<div><p>${escapeHtml(clean)}</p></div>`;
    return { title, html };
  }

  if (kind === "journal") {
    const title = `[JOURNAL] ${clean} (${stamp})`;
    const html = `<h2>${escapeHtml(title)}</h2>\n<div><p>${escapeHtml(clean)}</p></div>`;
    return { title, html };
  }

  if (kind === "travel") {
    const title = `[TRAVEL] ${clean} (${stamp})`;
    const html = `<h2>${escapeHtml(title)}</h2>\n<div><p>${escapeHtml(clean)}</p></div>`;
    return { title, html };
  }

  if (kind === "finance") {
    const title = `[FINANCE] ${clean} (${stamp})`;
    const html = `<h2>${escapeHtml(title)}</h2>\n<div><p>${escapeHtml(clean)}</p></div>`;
    return { title, html };
  }

  if (kind === "finance_planning") {
    const title = `[FINANCE • PLANNING] ${clean} (${stamp})`;
    const html = `<h2>${escapeHtml(title)}</h2>\n<div><p>${escapeHtml(clean)}</p></div>`;
    return { title, html };
  }

  if (kind === "options") {
    const title = `[OPTIONS] ${clean} (${stamp})`;
    const html = `<h2>${escapeHtml(title)}</h2>\n<div><p>${escapeHtml(clean)}</p></div>`;
    return { title, html };
  }

  if (kind === "wardrobe_outfit") {
    const title = `[WARDROBE] ${clean} (${stamp})`;
    const html = `<h2>${escapeHtml(title)}</h2>\n<div><p>${escapeHtml(clean)}</p></div>`;
    return { title, html };
  }

  if (kind === "wardrobe_shop") {
    const title = `[WARDROBE • SHOP] ${clean} (${stamp})`;
    const html = `<h2>${escapeHtml(title)}</h2>\n<div><p>${escapeHtml(clean)}</p></div>`;
    return { title, html };
  }

  // fallback
  const title = `[NOTE] ${clean} (${stamp})`;
  const html = `<h2>${escapeHtml(title)}</h2>\n<div><p>${escapeHtml(clean)}</p></div>`;
  return { title, html };
}

// --- Handler ----------------------------------------------------------------

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "Use POST with JSON { text }" });
      return;
    }
    const { text } = (req.body || {});
    if (!text || typeof text !== "string") {
      res.status(400).json({ ok: false, error: "Missing text" });
      return;
    }

    const { sectionKey, kind } = route(text);
    const sectionId = SECTIONS[sectionKey];
    if (!sectionId) {
      res.status(400).json({ ok: false, error: `Section not found: ${sectionKey}` });
      return;
    }

    const { title, html } = formatEntry(kind, text);

    // Minimal OneNote page HTML (OneNote requires a full HTML doc)
    const pageHtml =
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>` +
      `<body>${html}</body></html>`;

    const page = await createOneNotePageBySectionId(sectionId, pageHtml);

    res.status(200).json({ ok: true, routed: { sectionName: sectionKey, title, html }, page });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
