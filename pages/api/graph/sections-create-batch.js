// pages/api/graph/sections-create-batch.js
// Creates your OneNote section skeleton, sanitizing names for Graph.
// Usage:
//   /api/graph/sections-create-batch?notebookId=YOUR_NOTEBOOK_ID
//
// Returns { created[], skipped[], nameMap[] }

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

// Sanitize section names for OneNote (Graph error 20153)
/*
Forbidden chars per Graph error:
  ? * \ / : < > | & # ' % ~
We also normalize:
  "&" -> "and"
  "/" -> " - "
*/
function sanitizeName(name) {
  let out = name.replace(/&/g, "and").replace(/\//g, " - ");
  // remove the rest of forbidden chars
  out = out.replace(/[?*\\/:<>|&#'%~]/g, "");
  // collapse spaces, trim
  out = out.replace(/\s+/g, " ").trim();
  // guard against empty result
  if (!out) out = "Untitled";
  return out;
}

export default async function handler(req, res) {
  try {
    const token = getAccessTokenFromCookie(req);
    if (!token) return send(res, 401, { error: "No access_token cookie" });

    const notebookId = String(req.query.notebookId || "").trim();
    if (!notebookId) return send(res, 400, { error: "Missing notebookId" });

    // Desired skeleton (human-friendly labels).
    // NOTE: We'll sanitize before creation.
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

      // Archive
      "Archive"
    ];

    // Fetch existing sections (sanitized comparison)
    const sectionsUrl = `${GRAPH}/me/onenote/notebooks/${encodeURIComponent(notebookId)}/sections?$select=id,displayName&$top=100`;
    const existing = await gcollect(token, sectionsUrl);
    const existingSanitized = new Map(); // sanitizedName -> { id, displayName }
    for (const s of existing) {
      existingSanitized.set(sanitizeName(s.displayName || ""), { id: s.id, displayName: s.displayName });
    }

    const created = [];
    const skipped = [];
    const nameMap = []; // { desired, createdName }

    // Track used sanitized names to avoid collisions within this run
    const usedSanitized = new Set(existingSanitized.keys());

    for (const rawName of desired) {
      let san = sanitizeName(rawName);

      // If sanitized collides, append a suffix
      let attempt = san;
      let n = 2;
      while (usedSanitized.has(attempt.toLowerCase())) {
        // If exact display already exists with same semantics, treat as skipped
        const existingEntry = existingSanitized.get(attempt) || existingSanitized.get(attempt.toLowerCase());
        if (existingEntry) {
          skipped.push(existingEntry.displayName || attempt);
          nameMap.push({ desired: rawName, createdName: existingEntry.displayName || attempt, reason: "already-exists" });
          attempt = null;
          break;
        }
        attempt = `${san} ${n++}`;
      }
      if (attempt === null) continue;

      san = attempt;
      // If a matching (sanitized) already exists from earlier not caught above, skip
      if (existingSanitized.has(san) || existingSanitized.has(san.toLowerCase())) {
        skipped.push(san);
        nameMap.push({ desired: rawName, createdName: san, reason: "already-exists" });
        continue;
      }

      // Create
      const createdSection = await gjson(
        token,
        `${GRAPH}/me/onenote/notebooks/${encodeURIComponent(notebookId)}/sections`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayName: san })
        }
      );
      created.push({ name: san, id: createdSection.id });
      usedSanitized.add(san.toLowerCase());
      nameMap.push({ desired: rawName, createdName: san, id: createdSection.id, reason: "created" });
    }

    return send(res, 200, {
      notebookId,
      createdCount: created.length,
      skippedCount: skipped.length,
      created,
      skipped,
      nameMap
    });
  } catch (err) {
    return send(res, 500, { error: String(err && err.message || err) });
  }
}
