export default async function handler(req, res) {
  // CORS for ChatGPT Actions
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  // Bearer check
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token || token !== process.env.ACTION_BEARER_TOKEN) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  try {
    const base = process.env.PUBLIC_BASE_URL || "https://alice-onenote-router.vercel.app";

    // Find latest page id (your existing API)
    const latestResp = await fetch(`${base}/api/onenote/page-latest`);
    const latest = await latestResp.json();

    if (!latestResp.ok || latest.ok === false) {
      return res.status(500).json({ ok: false, error: "Failed to get latest page", detail: latest });
    }

    // Get plain text
    const textResp = await fetch(
      `${base}/api/onenote/page-text?id=${encodeURIComponent(latest.id)}`
    );
    const textJson = await textResp.json();

    if (!textResp.ok || textJson.ok === false) {
      return res.status(500).json({ ok: false, error: "Failed to fetch page text", detail: textJson });
    }

    return res.status(200).json({
      ok: true,
      id: latest.id,
      title: latest.title,
      text: textJson.text
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
