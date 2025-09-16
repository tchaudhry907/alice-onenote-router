// pages/api/graph/cleanup-tests.js
const PATTERNS = [
  "[DIAG]",
  "Diagnostics test",
  "quick log",
  "— quick log",
];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST" });

  const bearer =
    req.headers.authorization ||
    (req.cookies?.access_token ? `Bearer ${req.cookies.access_token}` : "");

  if (!bearer) return res.status(401).json({ ok: false, error: "No access token (header or cookie)" });

  try {
    const results = [];
    // Use OneNote page search (simple, broad). Do a pass per pattern.
    for (const term of PATTERNS) {
      const listResp = await fetch(`https://graph.microsoft.com/v1.0/me/onenote/pages?search=${encodeURIComponent(term)}&$select=id,title,createdDateTime,links`, {
        headers: { Authorization: bearer },
      });
      const listJson = await listResp.json();
      if (!listResp.ok) throw new Error(`graph GET pages search "${term}" -> ${listResp.status}: ${JSON.stringify(listJson)}`);

      for (const p of listJson.value || []) {
        const delResp = await fetch(`https://graph.microsoft.com/v1.0/me/onenote/pages/${encodeURIComponent(p.id)}`, {
          method: "DELETE",
          headers: { Authorization: bearer },
        });
        if (delResp.status === 204) {
          results.push({ id: p.id, title: p.title, deleted: true });
        } else {
          const txt = await delResp.text().catch(() => "");
          results.push({ id: p.id, title: p.title, deleted: false, status: delResp.status, body: txt });
        }
      }
    }

    return res.status(200).json({ ok: true, swept: results });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e.message || e) });
  }
}
