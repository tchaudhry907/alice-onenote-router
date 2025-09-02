// pages/api/show-graph.js
// Simple Graph "me" test using the access_token cookie we already set.
function getCookie(req, name) {
  const raw = req.headers?.cookie || "";
  const map = Object.fromEntries(
    raw.split(/;\s*/).filter(Boolean).map(p => {
      const i = p.indexOf("=");
      return [decodeURIComponent(p.slice(0, i)), decodeURIComponent(p.slice(i + 1))];
    })
  );
  return map[name];
}

export default async function handler(req, res) {
  try {
    const token = getCookie(req, "access_token");
    if (!token) {
      return res.status(401).json({ error: "No access_token cookie" });
    }

    const resp = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${token}` }
    });

    const text = await resp.text();
    if (!resp.ok) {
      return res.status(resp.status).json({ error: "Graph error", details: text });
    }

    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    console.error("show-graph error:", err);
    return res.status(500).json({ error: "Graph request failed", details: String(err?.message || err) });
  }
}
