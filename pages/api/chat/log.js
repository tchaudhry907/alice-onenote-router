// pages/api/chat/log.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  // --- Bearer token check (service auth from your GPT) ---
  const authz = req.headers.authorization || "";
  const token = process.env.ACTION_BEARER_TOKEN;
  if (!token || !authz.toLowerCase().startsWith("bearer ")) {
    return res.status(401).json({ ok: false, error: "Unauthorized (missing bearer)" });
  }
  const presented = authz.slice("bearer ".length);
  if (presented !== token) {
    return res.status(401).json({ ok: false, error: "Unauthorized (bad bearer)" });
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  } catch {
    return res.status(400).json({ ok: false, error: "Bad JSON body" });
  }
  const text = (body && body.text ? String(body.text) : "").trim();
  if (!text) return res.status(400).json({ ok: false, error: "Missing text" });

  // Build same-origin base URL for internal calls
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = (req.headers["x-forwarded-proto"] || "https");
  const base = `${proto}://${host}`;

  // Helper to POST JSON to our own routes
  const postJSON = (path, json) =>
    fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // NOTE: we’re server-side; cookies from the user’s browser aren’t needed here
      body: JSON.stringify(json || {}),
    });

  // 1) First try the simple path: use the working quick-log route
  let r = await postJSON("/api/onenote/quick-log", { text });
  let j;
  try { j = await r.json(); } catch (e) { j = { ok: false, error: "Non-JSON from quick-log" }; }

  // 2) If it failed due to a stale/missing page ID, create today’s page then retry once
  const looksLikeMissingPage =
    !j?.ok &&
    (r.status === 404 ||
     String(j?.error || "").toLowerCase().includes("resource id does not exist") ||
     String(j?.detail?.body || "").toLowerCase().includes("resource id does not exist"));

  if (looksLikeMissingPage) {
    // create/reuse today's Daily Log page in Inbox/Quick Notes
    await postJSON("/api/graph/page-create-to-inbox", {});
    // retry
    r = await postJSON("/api/onenote/quick-log", { text });
    try { j = await r.json(); } catch (e) { j = { ok: false, error: "Non-JSON from quick-log (retry)" }; }
  }

  if (j?.ok) {
    return res.status(200).json(j);
  }

  // Surface useful debug
  return res.status(r.status || 500).json({
    ok: false,
    error: j?.error || "Append failed",
    detail: j?.detail || null,
  });
}
