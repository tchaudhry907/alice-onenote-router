export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  // Bearer auth for ChatGPT Action
  const expected = process.env.ACTION_BEARER_TOKEN || "";
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!expected || token !== expected) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const base = `https://${req.headers.host}`;

  const latest = await fetch(`${base}/api/onenote/page-latest`);
  const jl = await latest.json().catch(() => ({}));
  if (!latest.ok || !jl?.ok) {
    return res.status(404).json({ ok: false, error: "No daily page" });
  }

  const textResp = await fetch(`${base}/api/onenote/page-text?id=${encodeURIComponent(jl.id)}`);
  const jt = await textResp.json().catch(() => ({}));
  if (!textResp.ok || !jt?.ok) {
    return res.status(500).json({ ok: false, error: "Failed to read page", detail: jt });
  }

  return res.status(200).json({ ok: true, id: jl.id, title: jl.title, text: jt.text });
}
