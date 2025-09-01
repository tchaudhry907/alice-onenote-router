// pages/api/graph/sections-create-batch.js
// Creates your full OneNote section skeleton if missing.
// Usage:
//   /api/graph/sections-create-batch?notebookId=YOUR_NOTEBOOK_ID
//
// Returns JSON with created[] and skipped[].

const GRAPH = "https://graph.microsoft.com/v1.0";

function send(res, code, data) {
  res.status(code).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data, null, 2));
}

function getAccessTokenFromCookie(req) {
  const hdr = req.headers.cookie || "";
  const map = Object.fromEntries(
    hdr.split(";").map(s => s.trim()).filter(Boolean).map(pair => {
      const i = pair.indexOf("=");
      return i === -1 ? [pair, ""] : [pair.slice(0, i), decodeURIComponent(pair.slice(i + 1))];
    })
  );
  return map["access_token"] || null;
}

async function g(token, url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json", ...(init.headers || {}) }
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Graph ${res.status} ${url} -> ${txt}`);
  }
  return res;
}

async function gjson(token, url, init = {}) {
  const r = await g(token, url, init);
  return r.status === 204 ? {} : r.json();
}

// Paged fetch helper (handles @odata.nextLink)
async function gcollect(token, firstUrl) {
  let url = firstUrl;
  const all = [];
  while (url) {
    const data = await gjson(token, url);
    if (Array.isArray(data.value)) all.push(...data.value);
    url = data["@odata.nextLink"] || null;
  }
  return all;
}

export default async function handler(req, res) {
  try {
    const token = getAccessTokenFromCookie(req);
    if (!token) return send(res, 401, { error: "No access_token cookie" });

    const notebookId = String(req.query.notebookId || "").trim();
    if (!notebookId) return send(res, 400, { error: "Missing notebookId" });

    // === Desired skeleton ===
    // We’re using simple section names (flat). The “/” is just part of the display name.
    const desired = [
      // Journal & Inbox
      "Journal",
      "Inbox",

      // Food & Nutrition
      "Food & Nutrition",
      "Food & Nutrition / Meals",
      "Food & Nutrition / Ingredients",
      "Food & Nutrition / Alcohol Notes",

      // Fitness
      "Fitness",
      "Fitness / Workouts",
      "Fitness / Progress",
      "Fitness / Step Counts",

      // Story & Creative
      "Story & Creative",
      "Story & Creative / Time Wound Saga",
      "Story & Creative / Ideas",
      "Story & Creative / Scenes",

      // Finance & Career
      "Finance & Career",
      "Finance & Career / Options Trading",
      "Finance & Career / Planning",

      // Lifestyle & Wardrobe
      "Lifestyle & Wardrobe",
      "Lifestyle & Wardrobe / Closet & Outfits",
      "Lifestyle & Wardrobe / Shopping List",

      // Archive (safe destination for cleanup moves)
      "Archive"
    ];

    // Fetch all existing sections
    const sectionsUrl = `${GRAPH}/me/onenote/notebooks/${encodeURIComponent(notebookId)}/sections?$select=id,displayName&$top=100`;
    const existing = await gcollect(token, sectionsUrl);
    const existingNamesLower = new Set(
      existing.map(s => (s.displayName || "").toLowerCase())
    );

    const created = [];
    const skipped = [];

    for (const name of desired) {
      if (existingNamesLower.has(name.toLowerCase())) {
        skipped.push(name);
        continue;
      }
      const createdSection = await gjson(
        token,
        `${GRAPH}/me/onenote/notebooks/${encodeURIComponent(notebookId)}/sections`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayName: name })
        }
      );
      created.push({ name, id: createdSection.id });
    }

    return send(res, 200, {
      notebookId,
      createdCount: created.length,
      skippedCount: skipped.length,
      created,
      skipped
    });
  } catch (err) {
    return send(res, 500, { error: String(err && err.message || err) });
  }
}
