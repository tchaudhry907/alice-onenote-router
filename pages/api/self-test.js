// pages/api/self-test.js
// One-click end-to-end smoke test for your OneNote router.
// Usage:
//   /api/self-test?notebookId=YOUR_NOTEBOOK_ID
//
// What it does:
// 1) Lists sections in the notebook
// 2) Resolves section IDs by name (case-insensitive, partial safe matching)
// 3) Creates sample pages in key sections (multipart XHTML)
// 4) Lists recent pages for those sections
// 5) Returns a JSON summary of everything

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
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json",
      ...(init.headers || {})
    }
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

// Paging helper
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

// Resolve section by display name (case-insensitive, allows "A - B" vs "A/B".
// Pass an array of candidate substrings; first match wins.
function resolveSection(sections, candidates) {
  const norm = s => (s || "").toLowerCase().replace(/&/g, "and").replace(/\//g, " - ").trim();
  const list = sections.map(s => ({ id: s.id, name: s.displayName || s.name || "" }));
  for (const c of candidates) {
    const needle = norm(c);
    // Prefer exact normalized match
    let exact = list.find(x => norm(x.name) === needle);
    if (exact) return exact;
    // Fallback: startsWith or includes
    let soft = list.find(x => norm(x.name).startsWith(needle)) || list.find(x => norm(x.name).includes(needle));
    if (soft) return soft;
  }
  return null;
}

// Create OneNote page (multipart/related) in a section
async function createPageMultipart(token, sectionId, title, bodyHtml) {
  const boundary = "----AliceRouterBoundary" + Math.random().toString(36).slice(2);
  const content =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="Presentation"\r\n` +
    `Content-Type: text/html\r\n\r\n` +
    `<!DOCTYPE html><html><head><title>${escapeHtml(title)}</title></head><body>\r\n` +
    `<h1>${escapeHtml(title)}</h1>\r\n` +
    `${bodyHtml}\r\n` +
    `</body></html>\r\n` +
    `--${boundary}--`;

  const url = `${GRAPH}/me/onenote/sections/${encodeURIComponent(sectionId)}/pages`;
  const res = await gjson(token, url, {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body: content
  });

  // Normalize some fields for convenience
  return {
    id: res.id,
    title: res.title,
    createdDateTime: res.createdDateTime,
    link: res?.links?.oneNoteClientUrl?.href || null,
    raw: res
  };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

export default async function handler(req, res) {
  try {
    const token = getAccessTokenFromCookie(req);
    if (!token) return send(res, 401, { error: "No access_token cookie. Visit /api/auth/login first (same tab)." });

    const notebookId = String(req.query.notebookId || "").trim();
    if (!notebookId) return send(res, 400, { error: "Missing notebookId" });

    // 1) List sections
    const sections = await gcollect(token,
      `${GRAPH}/me/onenote/notebooks/${encodeURIComponent(notebookId)}/sections?$select=id,displayName&$top=100`
    );

    // 2) Resolve target sections by name
    const targets = {
      journal: resolveSection(sections, ["Journal"]),
      alcohol: resolveSection(sections, ["Food & Nutrition / Alcohol Notes", "Food and Nutrition - Alcohol Notes"]),
      workouts: resolveSection(sections, ["Fitness / Workouts", "Fitness - Workouts"]),
      timeWound: resolveSection(sections, ["Story & Creative / Time Wound Saga", "Story and Creative - Time Wound Saga"]),
      closet: resolveSection(sections, ["Lifestyle & Wardrobe / Closet & Outfits", "Lifestyle and Wardrobe - Closet and Outfits"]),
    };

    const missing = Object.entries(targets).filter(([k, v]) => !v).map(([k]) => k);
    if (missing.length) {
      return send(res, 400, {
        error: "Missing expected sections — run sections-create-batch first",
        missing,
        note: "Expected to find Journal, Alcohol Notes, Workouts, Time Wound Saga, Closet & Outfits (sanitized names allowed).",
        sections: sections.map(s => ({ id: s.id, name: s.displayName }))
      });
    }

    // 3) Create sample pages
    const created = {};

    created.journal = await createPageMultipart(
      token,
      targets.journal.id,
      `Daily Log ${new Date().toISOString().slice(0,10)}`,
      `<p>Kicked off automated self-test from Alice Router.</p>`
    );

    created.alcohol = await createPageMultipart(
      token,
      targets.alcohol.id,
      "Japanese Whisky Tasting Notes",
      `<p><b>Brand:</b> (fill later)<br><b>Style:</b> (single malt/blend)<br><b>Nose:</b> …<br><b>Palate:</b> …<br><b>Finish:</b> …<br><b>Rating:</b> (x/10)</p><p>Notes: Tasted with Unker at airport lounge.</p>`
    );

    created.workouts = await createPageMultipart(
      token,
      targets.workouts.id,
      "Workout Template",
      `<p><b>Date:</b> <br><b>Type:</b> Push/Pull/Legs/Cardio<br><b>Sets × Reps:</b> <br><b>Notes:</b></p>`
    );

    created.timeWound = await createPageMultipart(
      token,
      targets.timeWound.id,
      "TW Saga – Scene Idea",
      `<p><b>Beat sheet:</b><br>- Inciting incident: …<br>- Reversal: …<br>- Climax: …</p><p><i>Research links: (add later)</i></p>`
    );

    created.closet = await createPageMultipart(
      token,
      targets.closet.id,
      "Outfit Index",
      `<p><b>Rules:</b> neutral capsule, seasonal rotation.<br><b>Ideas:</b> –</p>`
    );

    // 4) List recent pages for those sections (up to 10)
    async function listRecent(sectionId, top = 10) {
      const url = `${GRAPH}/me/onenote/sections/${encodeURIComponent(sectionId)}/pages?$select=id,title,createdDateTime,lastModifiedDateTime&$orderby=createdDateTime%20desc&$top=${Math.min(top, 100)}`;
      const items = await gcollect(token, url);
      return items.map(p => ({
        id: p.id,
        title: p.title,
        created: p.createdDateTime,
        lastModified: p.lastModifiedDateTime
      }));
    }

    const lists = {
      journal: await listRecent(targets.journal.id),
      alcohol: await listRecent(targets.alcohol.id),
      workouts: await listRecent(targets.workouts.id),
      timeWound: await listRecent(targets.timeWound.id),
      closet: await listRecent(targets.closet.id),
    };

    return send(res, 200, {
      ok: true,
      notebookId,
      sectionsResolved: {
        journal: targets.journal,
        alcohol: targets.alcohol,
        workouts: targets.workouts,
        timeWound: targets.timeWound,
        closet: targets.closet,
      },
      created,
      recent: lists
    });

  } catch (err) {
    return send(res, 500, { error: String(err && err.message || err) });
  }
}
