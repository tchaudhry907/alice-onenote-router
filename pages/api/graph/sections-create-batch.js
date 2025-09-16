// pages/api/graph/sections-create-batch.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST" });

  // Accept either Authorization header or previously-seeded cookie
  const bearer =
    req.headers.authorization ||
    (req.cookies?.access_token ? `Bearer ${req.cookies.access_token}` : "");

  if (!bearer) return res.status(401).json({ ok: false, error: "No access token (header or cookie)" });

  let body = {};
  try { body = req.body || {}; } catch {}
  const notebookName = (body.notebookName || "").trim();
  const sectionNames = Array.isArray(body.sectionNames) ? body.sectionNames.map(s => String(s).trim()).filter(Boolean) : [];

  if (!notebookName || sectionNames.length === 0) {
    return res.status(200).json({ ok: false, error: "notebookName and non-empty sectionNames[] required" });
  }

  try {
    // 1) Find notebook
    const nbResp = await fetch("https://graph.microsoft.com/v1.0/me/onenote/notebooks?$select=id,displayName", {
      headers: { Authorization: bearer },
    });
    const nbJson = await nbResp.json();
    if (!nbResp.ok) throw new Error(`graph GET notebooks -> ${nbResp.status}: ${JSON.stringify(nbJson)}`);

    const notebook = (nbJson.value || []).find(n => (n.displayName || "").trim().toLowerCase() === notebookName.toLowerCase());
    if (!notebook) throw new Error(`Notebook not found: ${notebookName}`);

    // 2) List sections
    const secResp = await fetch(`https://graph.microsoft.com/v1.0/me/onenote/notebooks/${encodeURIComponent(notebook.id)}/sections?$select=id,displayName`, {
      headers: { Authorization: bearer },
    });
    const secJson = await secResp.json();
    if (!secResp.ok) throw new Error(`graph GET sections -> ${secResp.status}: ${JSON.stringify(secJson)}`);

    const existing = new Map((secJson.value || []).map(s => [String(s.displayName || "").trim().toLowerCase(), s]));
    const created = [];
    const skipped = [];

    // 3) Create missing (POST notebook/sections with body {displayName})
    for (const name of sectionNames) {
      const key = name.toLowerCase();
      if (existing.has(key)) { skipped.push({ name, id: existing.get(key).id }); continue; }

      const cResp = await fetch(`https://graph.microsoft.com/v1.0/me/onenote/notebooks/${encodeURIComponent(notebook.id)}/sections`, {
        method: "POST",
        headers: { Authorization: bearer, "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name }),
      });
      const cJson = await cResp.json();
      if (!cResp.ok) throw new Error(`graph POST create section "${name}" -> ${cResp.status}: ${JSON.stringify(cJson)}`);
      created.push({ name, id: cJson.id });
    }

    return res.status(200).json({ ok: true, notebookId: notebook.id, created, skipped });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e.message || e) });
  }
}
