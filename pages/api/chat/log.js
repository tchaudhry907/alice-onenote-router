// pages/api/chat/log.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  // ----- Bearer token from your custom GPT -----
  const authz = req.headers.authorization || "";
  const token = process.env.ACTION_BEARER_TOKEN;
  if (!token || !authz.toLowerCase().startsWith("bearer ")) {
    return res.status(401).json({ ok: false, error: "Unauthorized (missing bearer)" });
  }
  const presented = authz.slice("bearer ".length);
  if (presented !== token) {
    return res.status(401).json({ ok: false, error: "Unauthorized (bad bearer)" });
  }

  // Body
  let payload = {};
  try { payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {}); } catch {}
  const text = (payload.text || "").toString().trim();
  if (!text) return res.status(400).json({ ok: false, error: "Missing text" });

  // Same-origin base
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const base = `${proto}://${host}`;

  // Helper
  const postJSON = (path, body) =>
    fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });

  // --- ULTRA-SAFE FLOW ---
  // 1) Always (idempotently) create/reuse today's page
  await postJSON("/api/graph/page-create-to-inbox", {});

  // 2) Append the entry
  const resp = await postJSON("/api/onenote/quick-log", { text });
  let j;
  try { j = await resp.json(); } catch { j = { ok: false, error: "Non-JSON from quick-log" }; }

  if (j?.ok) return res.status(200).json(j);

  // Try one more time after another create (belt & suspenders)
  await postJSON("/api/graph/page-create-to-inbox", {});
  const resp2 = await postJSON("/api/onenote/quick-log", { text });
  let j2; try { j2 = await resp2.json(); } catch { j2 = {}; }
  if (j2?.ok) return res.status(200).json(j2);

  return res.status(resp2.status || resp.status || 500).json({
    ok: false,
    error: j2?.error || j?.error || "Append failed",
    detail: j2?.detail || j?.detail || null,
  });
}
