// pages/api/graph/cleanup-tests.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST" });

  const bearer =
    req.headers.authorization ||
    (req.cookies?.access_token ? `Bearer ${req.cookies.access_token}` : "");
  if (!bearer) return res.status(401).json({ ok: false, error: "No access token (header or cookie)" });

  const prefixes = ["[DIAG]", "[WORKOUT]", "[HOBBY]", "[STEPS]"];
  const deleted = [];
  const errors = [];

  try {
    let url = "https://graph.microsoft.com/v1.0/me/onenote/pages?$top=50";
    // Use delta paging via @odata.nextLink when present
    while (url) {
      const resp = await fetch(url, { headers: { Authorization: bearer } });
      const data = await resp.json();
      if (!resp.ok) throw new Error(`graph GET pages -> ${resp.status}: ${JSON.stringify(data)}`);

      const items = data.value || [];
      // Filter by title prefixes
      const candidates = items.filter(p => {
        const t = (p.title || "").trim();
        return prefixes.some(pref => t.startsWith(pref));
      });

      // Delete each candidate
      for (const p of candidates) {
        const del = await fetch(`https://graph.microsoft.com/v1.0/me/onenote/pages/${encodeURIComponent(p.id)}`, {
          method: "DELETE",
          headers: { Authorization: bearer },
        });
        if (del.status === 204) {
          deleted.push({ id: p.id, title: p.title });
        } else {
          const j = await safeJson(del);
          errors.push({ id: p.id, title: p.title, status: del.status, error: j });
        }
      }

      url = data["@odata.nextLink"] || null;
    }

    return res.status(200).json({ ok: true, deleted, errors });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e.message || e), deleted, errors });
  }
}

async function safeJson(r) {
  try { return await r.json(); } catch { return { text: await r.text() }; }
}
