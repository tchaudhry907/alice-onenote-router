// pages/api/notes/ingest.js
//
// One endpoint for everything. POST JSON and it will decide the section,
// build a clean HTML page, and create it in your "AliceChatGPT" notebook.
//
// Auth: uses Authorization header OR the session cookies set from Diagnostics.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Use POST" });
  }

  // 0) Auth (header or cookie)
  const bearer =
    req.headers.authorization ||
    (req.cookies?.access_token ? `Bearer ${req.cookies.access_token}` : "");
  if (!bearer) {
    return res.status(401).json({ ok: false, error: "No access token (header or cookie)" });
  }

  try {
    const body = (req.body ?? {});

    // 1) Normalize + detect kind
    const notebookName = (body.notebookName || "AliceChatGPT").trim();

    // Accepted forms:
    // - { kind: "food"|"workout"|"steps"|"hobby"|"travel"|"tax"|"note", ... }
    // - Or "shape detection":
    //     calories/items -> food
    //     steps -> steps
    //     exercises or workoutText -> workout
    //     hobbyTitle/hobbyHtml -> hobby
    //     travelTitle/travelHtml -> travel
    //     taxTitle/taxHtml -> tax
    // - Fallback: note -> Inbox
    let kind = (body.kind || "").toLowerCase();
    if (!kind) {
      if (typeof body.calories !== "undefined" || Array.isArray(body.items)) kind = "food";
      else if (typeof body.steps !== "undefined") kind = "steps";
      else if (Array.isArray(body.exercises) || body.workoutText) kind = "workout";
      else if (body.hobbyTitle || body.hobbyHtml) kind = "hobby";
      else if (body.travelTitle || body.travelHtml) kind = "travel";
      else if (body.taxTitle || body.taxHtml) kind = "tax";
      else kind = "note";
    }

    const targets = {
      food: "Food",
      workout: "Fitness - Workouts",
      steps: "Fitness - Step Counts",
      hobby: "Hobbies",
      travel: "Travel",
      tax: "Taxes",
      note: "Inbox",
    };
    const sectionName = targets[kind] || "Inbox";

    // 2) Locate notebook and section (create section on the fly if missing)
    const nb = await findNotebook(bearer, notebookName);
    if (!nb) throw new Error(`Notebook not found: ${notebookName}`);

    const sec = await findOrCreateSection(bearer, nb.id, sectionName);

    // 3) Build a page per kind
    const page = buildPage(kind, body);

    // 4) Send to Graph (multipart/form-data with the HTML)
    const created = await createOneNotePage(bearer, sec.id, page.title, page.html);

    return res.status(200).json({ ok: true, kind, sectionName, created });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e.message || e) });
  }
}

/* ───────────────── helpers ───────────────── */

async function findNotebook(bearer, name) {
  const r = await fetch(
    "https://graph.microsoft.com/v1.0/me/onenote/notebooks?$select=id,displayName",
    { headers: { Authorization: bearer } }
  );
  const j = await r.json();
  if (!r.ok) throw new Error(`graph GET notebooks -> ${r.status}: ${JSON.stringify(j)}`);
  const low = name.trim().toLowerCase();
  return (j.value || []).find(n => (n.displayName || "").trim().toLowerCase() === low) || null;
}

async function findOrCreateSection(bearer, notebookId, sectionDisplay) {
  // try find
  const r1 = await fetch(
    `https://graph.microsoft.com/v1.0/me/onenote/notebooks/${encodeURIComponent(notebookId)}/sections?$select=id,displayName`,
    { headers: { Authorization: bearer } }
  );
  const j1 = await r1.json();
  if (!r1.ok) throw new Error(`graph GET sections -> ${r1.status}: ${JSON.stringify(j1)}`);
  const low = sectionDisplay.trim().toLowerCase();
  const found = (j1.value || []).find(s => (s.displayName || "").trim().toLowerCase() === low);
  if (found) return found;

  // create if missing
  const r2 = await fetch(
    `https://graph.microsoft.com/v1.0/me/onenote/notebooks/${encodeURIComponent(notebookId)}/sections`,
    {
      method: "POST",
      headers: { Authorization: bearer, "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: sectionDisplay }),
    }
  );
  const j2 = await r2.json();
  if (!r2.ok) throw new Error(`graph POST create section -> ${r2.status}: ${JSON.stringify(j2)}`);
  return j2;
}

async function createOneNotePage(bearer, sectionId, title, html) {
  const boundary = "----AliceIngestBoundary" + Math.random().toString(36).slice(2);
  const doc = `<!DOCTYPE html><html><head><title>${escapeHtml(title)}</title></head><body>${html}</body></html>`;
  const body =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="Presentation"\r\n` +
    `Content-Type: text/html\r\n\r\n` +
    doc + `\r\n` +
    `--${boundary}--\r\n`;

  const r = await fetch(
    `https://graph.microsoft.com/v1.0/me/onenote/sections/${encodeURIComponent(sectionId)}/pages`,
    {
      method: "POST",
      headers: { Authorization: bearer, "Content-Type": `multipart/form-data; boundary=${boundary}` },
      body,
    }
  );
  const j = await r.json();
  if (!r.ok) throw new Error(`graph POST create page -> ${r.status}: ${JSON.stringify(j)}`);
  return j;
}

/* ───────────── page builders ───────────── */

function buildPage(kind, body) {
  const now = new Date();
  switch (kind) {
    case "food": {
      const items = Array.isArray(body.items)
        ? body.items
        : (body.name ? [{ name: body.name, calories: body.calories, whenISO: body.whenISO }] : []);
      const title = items.length === 1
        ? `[FOOD] ${items[0].name || "Item"} — ${items[0].calories ?? "?"} kcal`
        : `[FOOD] ${now.toLocaleDateString()} — ${items.length} items`;

      const rows = items.map((it) => {
        const when = it.whenISO ? ` <em>(${fmtTime(it.whenISO)})</em>` : "";
        const kcal = it.calories != null && it.calories !== "" ? `${it.calories} kcal` : "";
        return `<tr><td>${escapeHtml(it.name || "")}${when}</td><td style="text-align:right">${kcal}</td></tr>`;
      }).join("");

      const html = `
        <h2>${escapeHtml(title)}</h2>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr><th align="left">Item</th><th align="right">Calories</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `.trim();
      return { title, html };
    }

    case "steps": {
      const steps = Number(body.steps) || 0;
      const title = `[STEPS] ${steps.toLocaleString()}`;
      const html = `<p>Step count for ${now.toLocaleDateString()}: <strong>${steps.toLocaleString()}</strong>.</p>`;
      return { title, html };
    }

    case "workout": {
      // Accept either {exercises:[{name,sets,reps,weight?},...]} or {workoutText:"..."}
      if (Array.isArray(body.exercises) && body.exercises.length) {
        const title = `[WORKOUT] ${body.label || "Session"}`;
        const rows = body.exercises.map((ex) => {
          const sets = ex.sets != null ? `${ex.sets}×` : "";
          const reps = ex.reps != null ? `${ex.reps}` : "";
          const w = ex.weight ? ` @ ${ex.weight}` : "";
          return `<li>${escapeHtml(ex.name || "")} — ${sets}${reps}${escapeHtml(w)}</li>`;
        }).join("");
        const html = `<ul>${rows}</ul>`;
        return { title, html };
      } else {
        const title = `[WORKOUT] ${body.label || "Notes"}`;
        const html = `<pre>${escapeHtml(body.workoutText || "")}</pre>`;
        return { title, html };
      }
    }

    case "hobby": {
      const title = body.title || body.hobbyTitle || "[HOBBY] Note";
      const html = body.html || body.hobbyHtml || wrapText(body.text || body.hobbyText || "");
      return { title: ensurePrefix(title, "[HOBBY]"), html };
    }

    case "travel": {
      const title = body.title || body.travelTitle || "[TRAVEL] Note";
      const html = body.html || body.travelHtml || wrapText(body.text || body.travelText || "");
      return { title: ensurePrefix(title, "[TRAVEL]"), html };
    }

    case "tax": {
      const title = body.title || body.taxTitle || "[TAX] Note";
      const html = body.html || body.taxHtml || wrapText(body.text || body.taxText || "");
      return { title: ensurePrefix(title, "[TAX]"), html };
    }

    default: {
      const title = body.title || "[NOTE]";
      const html = body.html || wrapText(body.text || "");
      return { title, html };
    }
  }
}

/* ───────────── utils ───────────── */

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
}
function wrapText(t) {
  return `<p>${escapeHtml(String(t || "")).replace(/\n/g, "<br/>")}</p>`;
}
function fmtTime(iso) {
  try { return new Date(iso).toLocaleString(); } catch { return iso || ""; }
}
function ensurePrefix(title, prefix) {
  return String(title).startsWith(prefix) ? title : `${prefix} ${title}`;
}
