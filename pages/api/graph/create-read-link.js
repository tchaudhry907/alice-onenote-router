export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { title, html } = req.body;

    if (!title || !html) {
      return res.status(400).json({ ok: false, error: "Missing title or html" });
    }

    const token = process.env.ACTION_BEARER_TOKEN;
    if (!token) {
      throw new Error("Missing ACTION_BEARER_TOKEN in environment");
    }

    // Step 1: create page
    const createRes = await fetch(`${process.env.APP_BASE_URL}/api/graph/page-create-to-inbox`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title, html }),
    });

    const created = await createRes.json();
    if (!created?.created?.id) {
      return res.status(500).json({ ok: false, error: "Failed to create page", details: created });
    }

    const pid = created.created.id;

    // Step 2: get page text
    const textRes = await fetch(`${process.env.APP_BASE_URL}/api/onenote/page-text?id=${encodeURIComponent(pid)}`, {
      headers: { "Authorization": `Bearer ${token}` },
    });
    const textJson = await textRes.json();

    // Step 3: get links
    const linksRes = await fetch(`${process.env.APP_BASE_URL}/api/onenote/links`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids: [pid] }),
    });
    const linksJson = await linksRes.json();

    res.status(200).json({
      ok: true,
      created: created.created,
      text: textJson.text || "",
      links: linksJson.links?.[0] || {},
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || "Unknown error" });
  }
}
