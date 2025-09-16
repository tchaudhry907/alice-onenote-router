// pages/api/graph/sections-create-batch.js
//
// Create any missing sections inside a given OneNote notebook by NAME.
// Auth: pull bearer from "Authorization: Bearer <token>" header OR from cookie "access_token=<token>".
// No other project imports required.

async function authHeaders(req) {
  const headers = {};

  // 1) Authorization header?
  const auth = req.headers?.authorization || "";
  if (auth.startsWith("Bearer ")) {
    headers["Authorization"] = auth;
  }

  // 2) Cookie fallback: access_token=<...>
  if (!headers["Authorization"]) {
    const cookie = req.headers?.cookie || "";
    const m = cookie.match(/(?:^|;\s*)access_token=([^;]+)/);
    if (m) {
      headers["Authorization"] = `Bearer ${decodeURIComponent(m[1])}`;
    }
  }

  // 3) Last-resort env (useful in server-only jobs)
  if (!headers["Authorization"] && process.env.MS_GRAPH_BEARER) {
    headers["Authorization"] = `Bearer ${process.env.MS_GRAPH_BEARER}`;
  }

  if (!headers["Authorization"]) {
    throw new Error("No access token (Authorization header or access_token cookie missing)");
  }

  return headers;
}

async function graphGET(req, path) {
  const r = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: await authHeaders(req),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`graphGET ${path} -> ${r.status}: ${t}`);
  }
  return r.json();
}

async function graphPOST(req, path, body, contentType = "application/json") {
  const r = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    method: "POST",
    headers: { ...(await authHeaders(req)), "Content-Type": contentType },
    body: contentType === "application/json" ? JSON.stringify(body) : body,
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`graphPOST ${path} -> ${r.status}: ${t}`);
  }
  return r.json();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { notebookName, sectionNames = [] } = req.body || {};
    if (!notebookName) {
      return res.status(400).json({ ok: false, error: "notebookName required" });
    }
    if (!Array.isArray(sectionNames) || sectionNames.length === 0) {
      return res.status(400).json({ ok: false, error: "sectionNames must be a non-empty array" });
    }

    // Find the notebook by displayName
    const nbResp = await graphGET(req, `/me/onenote/notebooks?$select=id,displayName`);
    const notebooks = nbResp.value || nbResp.notebooks || [];
    const nb = notebooks.find(
      (n) => (n.displayName || n.name || "").toLowerCase() === String(notebookName).toLowerCase()
    );
    if (!nb) {
      return res.status(404).json({ ok: false, error: `Notebook not found: ${notebookName}` });
    }

    // Get existing sections
    const secResp = await graphGET(req, `/me/onenote/notebooks/${nb.id}/sections?$select=id,displayName`);
    const existing = (secResp.value || secResp.sections || []).map((s) => ({
      id: s.id,
      name: s.displayName || s.name || "",
      key: (s.displayName || s.name || "").toLowerCase(),
    }));

    // Create any missing sections
    const created = [];
    const skipped = [];
    for (const name of sectionNames) {
      const key = String(name).toLowerCase();
      const found = existing.find((e) => e.key === key);
      if (found) {
        skipped.push({ name, id: found.id });
        continue;
      }
      const made = await graphPOST(req, `/me/onenote/notebooks/${nb.id}/sections`, { displayName: name });
      created.push({ name, id: made.id });
      existing.push({ id: made.id, name, key });
    }

    return res.status(200).json({
      ok: true,
      notebookId: nb.id,
      created,
      skipped,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = /No access token/.test(msg) ? 401 : 400;
    return res.status(status).json({ ok: false, error: msg });
  }
}
