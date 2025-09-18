// pages/api/log.js
import { NOTEBOOK_NAME, resolveSectionId, SECTIONS } from "@/lib/sections";
import { nowInTZ } from "@/lib/time";
import { kv } from "@vercel/kv";

async function getGraphToken() {
  // Token was already being saved under this key in your app
  return await kv.get("graph:access_token");
}

// Fallback: only if a section name can't be resolved, list sections once.
async function healSectionsIfNeeded(targetName) {
  const id = resolveSectionId(targetName);
  if (id) return id;

  const token = await getGraphToken();
  if (!token) return null;

  // Pull sections for the AliceChatGPT notebook
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/onenote/notebooks?$select=id,displayName`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const nb = (data.value || []).find(n => n.displayName === NOTEBOOK_NAME);
  if (!nb) return null;

  const secRes = await fetch(`https://graph.microsoft.com/v1.0/me/onenote/notebooks/${nb.id}/sections?$select=id,displayName&top=200`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!secRes.ok) return null;
  const secData = await secRes.json();

  // Cache a simple map in KV for a day
  const map = {};
  for (const s of secData.value || []) {
    map[s.displayName] = s.id;
  }
  await kv.set("sections:live", map, { ex: 86400 });

  // Try again with both hyphen variants
  const ascii = String(targetName).replace(/\u2013/g, "-");
  const enDash = String(targetName).replace(/-/g, "–");

  return map[targetName] || map[ascii] || map[enDash] || null;
}

function classify(text) {
  const t = (text || "").toLowerCase().trim();

  // Steps
  const mSteps = t.match(/\b(?:walk(?:ed)?|steps?)\s+(\d{3,6})(?:\s*steps?)?\b/);
  if (mSteps) return { kind: "steps", value: mSteps[1] };

  // Workout
  if (/\bworkout\b|\bgym\b|\brun\b|\bupper body\b|\blower body\b/.test(t))
    return { kind: "workout", value: text };

  // Alcohol
  if (/\b(whisk|whiskey|vodka|wine|beer|mezcal|bourbon|gin|rum)\b/.test(t))
    return { kind: "alcohol", value: text };

  // Wardrobe shopping (common clothing words + buy/need)
  if (/\b(belt|sock|shirt|pants|jeans|jacket|coat|shoe|sneaker|tie|dress)\b/.test(t) &&
      /\b(buy|need|pick up|order)\b/.test(t))
    return { kind: "wardrobe", value: text };

  // Meal (ate / calories / breakfast/lunch/dinner)
  if (/^ate\b|\bcalori|breakfast|lunch|dinner|snack/.test(t))
    return { kind: "meal", value: text };

  // Finance
  if (/\b(paid|pay|bill|expense|transfer|salary|deposit|invoice)\b/.test(t))
    return { kind: "finance", value: text };

  // Journal catch-all
  if (/\b(journal|reflection|gratitude|note:)\b/.test(t))
    return { kind: "journal", value: text };

  // Default: generic Food & Nutrition note
  return { kind: "note", value: text };
}

function render(kind, value, stamp) {
  switch (kind) {
    case "steps":
      return {
        sectionName: "Fitness – Step Counts",
        title: `[STEPS] ${value} (${stamp})`,
        html: `<h2>[STEPS] ${value} (${stamp})</h2><div><p>Steps: <b>${value}</b></p><p>Note: walked ${value} steps</p></div>`
      };
    case "workout":
      return {
        sectionName: "Fitness – Workouts",
        title: `[WORKOUT] ${value} (${stamp})`,
        html: `<h2>[WORKOUT] ${value} (${stamp})</h2><div><p>Workout: <b>${value}</b></p></div>`
      };
    case "meal":
      return {
        sectionName: "Food and Nutrition – Meals",
        title: `[MEAL] ${value} (${stamp})`,
        html: `<h2>[MEAL] ${value} (${stamp})</h2><div><p>${value}</p></div>`
      };
    case "alcohol":
      return {
        sectionName: "Food and Nutrition – Alcohol Notes",
        title: `[ALCOHOL] ${value} (${stamp})`,
        html: `<h2>[ALCOHOL] ${value} (${stamp})</h2><div><p>${value}</p></div>`
      };
    case "wardrobe":
      return {
        sectionName: "Lifestyle and Wardrobe – Shopping List",
        title: `[WARDROBE] ${value} (${stamp})`,
        html: `<h2>[WARDROBE] ${value} (${stamp})</h2><div><p>${value}</p></div>`
      };
    case "finance":
      return {
        sectionName: "Finance & Career",
        title: `[FINANCE] ${value}`,
        html: `<h2>[FINANCE] ${value}</h2><div><p>${value}</p></div>`
      };
    case "journal":
      return {
        sectionName: "Journal",
        title: `[JOURNAL] ${value} (${stamp})`,
        html: `<h2>[JOURNAL] ${value} (${stamp})</h2><div><p>${value}</p></div>`
      };
    default:
      return {
        sectionName: "Food and Nutrition",
        title: `[NOTE] ${value} (${stamp})`,
        html: `<h2>[NOTE] ${value} (${stamp})</h2><div><p>${value}</p></div>`
      };
  }
}

async function createPage({ sectionId, title, html }) {
  const token = await getGraphToken();
  if (!token) throw new Error("No Graph access token in KV");

  const res = await fetch(`https://graph.microsoft.com/v1.0/me/onenote/sections/${encodeURIComponent(sectionId)}/pages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/xhtml+xml",
    },
    body: `<!DOCTYPE html><html><head><title>${title}</title></head><body>${html}</body></html>`
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Graph create failed: ${res.status}`);
    err.details = { status: res.status, body };
    throw err;
  }
  return body;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

    const { text } = (req.body || {});
    if (!text) return res.status(400).json({ ok: false, error: "Missing text" });

    // Duplicate guard (30s)
    const norm = text.trim().toLowerCase().replace(/\s+/g, " ");
    const dupKey = `dedupe:${norm}`;
    const seen = await kv.get(dupKey);
    if (seen) return res.json({ ok: true, deduped: true, message: "Dropped duplicate within 30s window." });
    await kv.set(dupKey, 1, { ex: 30 });

    // Local timestamp
    const { stamp } = nowInTZ();

    // Classify + render
    const c = classify(text);
    const payload = render(c.kind, c.value, stamp);

    // Resolve section id (fast map → fallback heal if needed)
    let sectionId = resolveSectionId(payload.sectionName);
    if (!sectionId) sectionId = await healSectionsIfNeeded(payload.sectionName);
    if (!sectionId) return res.status(400).json({ ok: false, error: `Section not found: ${payload.sectionName}` });

    // Create page
    const page = await createPage({ sectionId, title: payload.title, html: payload.html });

    res.json({ ok: true, routed: { sectionName: payload.sectionName, sectionId, title: payload.title, html: payload.html }, page });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || String(e), details: e.details || null });
  }
}
