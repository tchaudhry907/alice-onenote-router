// pages/api/graph/archive-pages.js
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

// Paged fetch helper
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

async function findSectionByName(token, notebookId, displayName) {
  const url = `${GRAPH}/me/onenote/notebooks/${encodeURIComponent(notebookId)}/sections?$select=id,displayName&$top=100`;
  const sections = await gcollect(token, url);
  const hit = sections.find(s => (s.displayName || "").toLowerCase() === displayName.toLowerCase());
  return hit ? { id: hit.id, name: hit.displayName } : null;
}

async function ensureArchive(token, notebookId) {
  let arch = await findSectionByName(token, notebookId, "Archive");
  if (arch) return arch;
  const created = await gjson(
    token,
    `${GRAPH}/me/onenote/notebooks/${encodeURIComponent(notebookId)}/sections`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "Archive" })
    }
  );
  return { id: created.id, name: created.displayName };
}

export default async function handler(req, res) {
  try {
    const token = getAccessTokenFromCookie(req);
    if (!token) return send(res, 401, { error: "No access_token cookie" });

    const notebookId = String(req.query.notebookId || "").trim();
    const sectionName = String(req.query.sectionName || "Inbox").trim();
    const olderThanDays = parseInt(String(req.query.olderThanDays || "30"), 10);
    const dryRun = String(req.query.dryRun || "false").toLowerCase() === "true";
    if (!notebookId) return send(res, 400, { error: "Missing notebookId" });

    const source = await findSectionByName(token, notebookId, sectionName);
    if (!source) return send(res, 404, { error: `Section '${sectionName}' not found` });

    const cutoffISO = new Date(Date.now() - olderThanDays * 24 * 3600 * 1000).toISOString();

    // Get *all* pages (paged, $top=100)
    const pagesUrl = `${GRAPH}/me/onenote/sections/${encodeURIComponent(source.id)}/pages?$select=id,title,createdDateTime,lastModifiedDateTime&$top=100`;
    const pages = await gcollect(token, pagesUrl);
    const oldPages = pages.filter(p => (p.createdDateTime || "") < cutoffISO);

    if (dryRun) {
      return send(res, 200, {
        mode: "dryRun",
        section: source,
        olderThanDays,
        cutoffISO,
        count: oldPages.length,
        pages: oldPages.slice(0, 25).map(p => ({ id: p.id, title: p.title, created: p.createdDateTime }))
      });
    }

    if (oldPages.length === 0) {
      return send(res, 200, { info: "Nothing to archive", section: source, olderThanDays, cutoffISO });
    }

    const archive = await ensureArchive(token, notebookId);
    const moved = [];
    const failed = [];

    for (const p of oldPages) {
      try {
        // Copy to Archive
        await gjson(token, `${GRAPH}/me/onenote/pages/${encodeURIComponent(p.id)}/copyToSection`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: archive.id })
        });
        // Delete original
        await g(token, `${GRAPH}/me/onenote/pages/${encodeURIComponent(p.id)}`, { method: "DELETE" });
        moved.push({ id: p.id, title: p.title, created: p.createdDateTime });
      } catch (e) {
        failed.push({ id: p.id, title: p.title, error: String(e && e.message || e) });
      }
    }

    return send(res, 200, {
      archivedTo: archive,
      movedCount: moved.length,
      moved,
      failedCount: failed.length,
      failed
    });
  } catch (err) {
    return send(res, 500, { error: String(err && err.message || err) });
  }
}
