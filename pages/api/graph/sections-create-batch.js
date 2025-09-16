// pages/api/graph/sections-create-batch.js
// Idempotently ensure a set of sections exist inside a notebook.
// Auth: accepts Authorization header OR `access_token` cookie.
// POST body: { notebookName: string, sectionNames: string[] }
//
// Response: { ok: true, notebookId, created: [{name,id}], skipped: [{name,id}] }

function s(x) { try { return JSON.stringify(x); } catch { return String(x); } }

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Use POST" });
  }

  // Auth via header OR cookie
  const bearer =
    req.headers.authorization ||
    (req.cookies?.access_token ? `Bearer ${req.cookies.access_token}` : "");
  if (!bearer) return res.status(401).json({ ok: false, error: "No access token" });

  const { notebookName, sectionNames } = req.body || {};
  if (!notebookName || !Array.isArray(sectionNames) || sectionNames.length === 0) {
    return res.status(400).json({ ok: false, error: "notebookName and non-empty sectionNames[] required" });
  }

  try {
    // 1) Find the notebook
    const nbResp = await fetch(
      "https://graph.microsoft.com/v1.0/me/onenote/notebooks?$select=id,displayName",
      { headers: { Authorization: bearer } }
    );
    const nbJson = await nbResp.json();
    if (!nbResp.ok) throw new Error(`graph GET notebooks -> ${nbResp.status}: ${s(nbJson)}`);

    const notebook = (nbJson.value || []).find(
      n => (n.displayName || "").trim().toLowerCase() === notebookName.trim().toLowerCase()
    );
    if (!notebook) throw new Error(`Notebook not found: ${notebookName}`);

    // 2) Fetch existing sections
    const secResp = await fetch(
      `https://graph.microsoft.com/v1.0/me/onenote/notebooks/${encodeURIComponent(notebook.id)}/sections?$select=id,displayName`,
      { headers: { Authorization: bearer } }
    );
    const secJson = await secResp.json();
    if (!secResp.ok) throw new Error(`graph GET sections -> ${secResp.status}: ${s(secJson)}`);

    const existing = new Map(
      (secJson.value || []).map(sct => [ (sct.displayName || "").trim().toLowerCase(), sct ])
    );

    // 3) Create any missing sections
    const created = [];
    const skipped = [];

    for (const rawName of sectionNames) {
      const name = String(rawName || "").trim();
      if (!name) continue;

      const key = name.toLowerCase();
      if (existing.has(key)) {
        const sct = existing.get(key);
        skipped.push({ name, id: sct.id });
        continue;
      }

      const createResp = await fetch(
        `https://graph.microsoft.com/v1.0/me/onenote/notebooks/${encodeURIComponent(notebook.id)}/sections`,
        {
          method: "POST",
          headers: {
            Authorization: bearer,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ displayName: name }),
        }
      );
      const createdJson = await createResp.json();
      if (!createResp.ok) {
        // If Graph fails, surface which section caused it
        throw new Error(`graph POST create section "${name}" -> ${createResp.status}: ${s(createdJson)}`);
      }

      created.push({ name, id: createdJson.id });
      existing.set(key, createdJson);
    }

    return res.status(200).json({
      ok: true,
      notebookId: notebook.id,
      created,
      skipped,
    });
  } catch (e) {
    // Keep network 200 so UI can easily display the message
    return res.status(200).json({ ok: false, error: String(e?.message || e) });
  }
}
