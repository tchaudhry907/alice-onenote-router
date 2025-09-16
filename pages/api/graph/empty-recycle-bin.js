// pages/api/graph/empty-recycle-bin.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST" });

  const bearer =
    req.headers.authorization ||
    (req.cookies?.access_token ? `Bearer ${req.cookies.access_token}` : "");
  if (!bearer) return res.status(401).json({ ok: false, error: "No access token (header or cookie)" });

  const notebookName = "AliceChatGPT";
  const sectionName = "Recycle Bin";
  const removed = [];
  const errors = [];

  try {
    const nb = await fetch("https://graph.microsoft.com/v1.0/me/onenote/notebooks?$select=id,displayName", {
      headers: { Authorization: bearer },
    }).then(jok);
    const notebook = (nb.value || []).find(n => (n.displayName || "").toLowerCase() === notebookName.toLowerCase());
    if (!notebook) throw new Error(`Notebook not found: ${notebookName}`);

    const secs = await fetch(`https://graph.microsoft.com/v1.0/me/onenote/notebooks/${encodeURIComponent(notebook.id)}/sections?$select=id,displayName`, {
      headers: { Authorization: bearer },
    }).then(jok);
    const section = (secs.value || []).find(s => (s.displayName || "").toLowerCase() === sectionName.toLowerCase());
    if (!section) return res.status(200).json({ ok: true, removed, errors, note: "Recycle Bin section not found; nothing to empty." });

    // Page through section pages
    let url = `https://graph.microsoft.com/v1.0/me/onenote/sections/${encodeURIComponent(section.id)}/pages?$top=50`;
    while (url) {
      const pageResp = await fetch(url, { headers: { Authorization: bearer } });
      const pageJson = await pageResp.json();
      if (!pageResp.ok) throw new Error(`graph GET section pages -> ${pageResp.status}: ${JSON.stringify(pageJson)}`);

      for (const p of pageJson.value || []) {
        const del = await fetch(`https://graph.microsoft.com/v1.0/me/onenote/pages/${encodeURIComponent(p.id)}`, {
          method: "DELETE",
          headers: { Authorization: bearer },
        });
        if (del.status === 204) removed.push({ id: p.id, title: p.title });
        else errors.push({ id: p.id, title: p.title, status: del.status, error: await safeJson(del) });
      }

      url = pageJson["@odata.nextLink"] || null;
    }

    return res.status(200).json({ ok: true, removed, errors });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e.message || e), removed, errors });
  }
}

async function jok(r) {
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j));
  return j;
}
async function safeJson(r) {
  try { return await r.json(); } catch { return { text: await r.text() }; }
}
