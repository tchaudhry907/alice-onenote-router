// pages/api/chat/today.js
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  // Bearer check (same as /chat/log)
  const authz = req.headers.authorization || "";
  const token = process.env.ACTION_BEARER_TOKEN;
  if (!token || !authz.toLowerCase().startsWith("bearer ")) {
    return res.status(401).json({ ok: false, error: "Unauthorized (missing bearer)" });
  }
  const presented = authz.slice("bearer ".length);
  if (presented !== token) {
    return res.status(401).json({ ok: false, error: "Unauthorized (bad bearer)" });
  }

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = (req.headers["x-forwarded-proto"] || "https");
  const base = `${proto}://${host}`;

  // Get latest page id + title
  const latestResp = await fetch(`${base}/api/onenote/page-latest`);
  let latest;
  try { latest = await latestResp.json(); } catch { latest = {}; }

  if (!latest?.ok) {
    return res.status(latestResp.status || 500).json({ ok: false, error: "Failed to get latest page", detail: latest });
  }

  // Fetch plain text
  const textResp = await fetch(`${base}/api/onenote/page-text?id=${encodeURIComponent(latest.id)}`);
  let textJson;
  try { textJson = await textResp.json(); } catch { textJson = {}; }

  if (!textJson?.ok) {
    return res.status(textResp.status || 500).json({ ok: false, error: "Failed to get page text", detail: textJson });
  }

  return res.status(200).json({
    ok: true,
    id: latest.id,
    title: latest.title,
    text: textJson.text || "",
  });
}
