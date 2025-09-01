// pages/api/graph/audit-report.js
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

async function gj(token, path) {
  const res = await fetch(`${GRAPH}${path}`, { headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" } });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Graph ${res.status} ${path} -> ${txt}`);
  }
  return res.json();
}

export default async function handler(req, res) {
  try {
    const token = getAccessTokenFromCookie(req);
    if (!token) return send(res, 401, { error: "No access_token cookie" });

    const notebookId = String(req.query.notebookId || "").trim();
    const olderThanDays = parseInt(String(req.query.olderThanDays || "30"), 10);
    if (!notebookId) return send(res, 400, { error: "Missing notebookId" });

    const cutoffISO = new Date(Date.now() - olderThanDays * 24 * 3600 * 1000).toISOString();

    const sections = await gj(token, `/me/onenote/notebooks/${encodeURIComponent(notebookId)}/sections?$select=id,displayName&$top=500`);
    const report = [];

    for (const s of (sections.value || [])) {
      const pages = await gj(token, `/me/onenote/sections/${encodeURIComponent(s.id)}/pages?$select=id,title,createdDateTime,lastModifiedDateTime&$top=200`);
      const value = pages.value || [];
      const old = value.filter(p => (p.createdDateTime || "") < cutoffISO);
      report.push({
        sectionId: s.id,
        sectionName: s.displayName,
        totalPages: value.length,
        oldPages: old.length,
        sampleOld: old.slice(0, 5).map(p => ({ id: p.id, title: p.title, created: p.createdDateTime }))
      });
    }

    const emptySections = report.filter(r => r.totalPages === 0);
    const manyOldPages = report.filter(r => r.oldPages >= 5);
    const heavySections = report.filter(r => r.totalPages >= 50);

    return send(res, 200, {
      notebookId,
      olderThanDays,
      cutoffISO,
      summary: {
        sections: report.length,
        emptySections: emptySections.length,
        manyOldPages: manyOldPages.length,
        heavySections: heavySections.length
      },
      emptySections,
      manyOldPages,
      heavySections
    });
  } catch (err) {
    return send(res, 500, { error: String(err && err.message || err) });
  }
}
