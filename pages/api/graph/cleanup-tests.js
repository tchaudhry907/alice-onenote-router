// pages/api/graph/cleanup-tests.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Use POST" });
  }

  const bearer =
    req.headers.authorization ||
    (req.cookies?.access_token ? `Bearer ${req.cookies.access_token}` : "");

  if (!bearer) {
    return res.status(401).json({ ok: false, error: "No access token (header or cookie)" });
  }

  const matchesTestTitle = (title = "") => {
    const t = String(title).toLowerCase();
    return (
      /^\[diag\]/i.test(title) ||
      t.includes("diagnostics") ||
      t.includes("test page")
    );
  };

  let scanned = 0;
  let deleted = 0;
  let kept = 0;
  const deletedIds = [];
  const keptSamples = [];

  try {
    let url = "https://graph.microsoft.com/v1.0/me/onenote/pages?$select=id,title,createdDateTime&$top=100";
    let guard = 0; // safety to avoid infinite loops

    while (url && guard++ < 200) {
      const r = await fetch(url, { headers: { Authorization: bearer } });
      const j = await r.json();
      if (!r.ok) {
        return res
          .status(200)
          .json({ ok: false, error: `graph GET pages -> ${r.status}: ${JSON.stringify(j)}` });
      }

      const rows = Array.isArray(j.value) ? j.value : [];
      for (const p of rows) {
        scanned++;
        if (matchesTestTitle(p.title)) {
          const del = await fetch(
            `https://graph.microsoft.com/v1.0/me/onenote/pages/${encodeURIComponent(p.id)}`,
            { method: "DELETE", headers: { Authorization: bearer } }
          );
          if (del.status === 204) {
            deleted++;
            deletedIds.push(p.id);
          } else {
            // if delete fails, keep record but don’t fail whole sweep
            kept++;
            keptSamples.push({ id: p.id, title: p.title, deleteStatus: del.status });
          }
        } else {
          kept++;
          if (keptSamples.length < 10) keptSamples.push({ id: p.id, title: p.title });
        }
      }

      url = j["@odata.nextLink"] || null;
    }

    return res.status(200).json({
      ok: true,
      scanned,
      deleted,
      kept,
      deletedIds,
    });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e.message || e) });
  }
}
