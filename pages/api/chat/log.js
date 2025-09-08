export default async function handler(req, res) {
  // CORS for ChatGPT Actions
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  // Bearer check
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token || token !== process.env.ACTION_BEARER_TOKEN) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  try {
    const { text } = req.body || {};
    if (!text || typeof text !== "string") {
      return res.status(400).json({ ok: false, error: "Missing text" });
    }

    // Re-use your working quick-log endpoint server-to-server
    const base = process.env.PUBLIC_BASE_URL || "https://alice-onenote-router.vercel.app";
    const r = await fetch(`${base}/api/onenote/quick-log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok || data.ok === false) {
      return res.status(500).json({
        ok: false,
        error: "Append failed",
        detail: data || (await r.text())
      });
    }

    return res.status(200).json({
      ok: true,
      pageId: data.pageId,
      title: data.title
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
