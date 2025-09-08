export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  // Bearer auth for ChatGPT Action
  const expected = process.env.ACTION_BEARER_TOKEN || "";
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!expected || token !== expected) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  // Parse body
  let text = "";
  try {
    if (req.headers["content-type"] && req.headers["content-type"].includes("application/json")) {
      text = (req.body?.text ?? "").toString();
    } else if (typeof req.body === "string") {
      const parsed = JSON.parse(req.body);
      text = (parsed?.text ?? "").toString();
    }
  } catch (_) {}
  if (!text || !text.trim()) return res.status(400).json({ ok: false, error: "Missing `text`" });

  const base = `https://${req.headers.host}`;

  // 1) ensure tokens are fresh (cookies on server)
  const r1 = await fetch(`${base}/api/auth/refresh`, { method: "POST", headers: { "Content-Type": "application/json" } });
  const j1 = await r1.json().catch(() => ({}));
  if (!r1.ok || !j1?.ok) {
    return res.status(401).json({ ok: false, error: "Auth refresh failed", detail: j1 });
  }

  // 2) append
  const r2 = await fetch(`${base}/api/onenote/quick-log`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const j2 = await r2.json().catch(() => ({}));
  if (!r2.ok || !j2?.ok) {
    return res.status(500).json({ ok: false, error: "Append failed", detail: j2 });
  }

  // 3) confirm latest
  const r3 = await fetch(`${base}/api/onenote/page-latest`);
  const j3 = await r3.json().catch(() => ({}));

  return res.status(200).json({ ok: true, pageId: j2.pageId || j3?.id || null, title: j3?.title || null });
}
