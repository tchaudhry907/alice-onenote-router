// pages/api/debug/show-cookies.js
export default function handler(req, res) {
  try {
    const raw = req.headers.cookie || "";
    const parsed = {};
    raw.split(";").map(s => s.trim()).filter(Boolean).forEach(pair => {
      const i = pair.indexOf("=");
      const k = i >= 0 ? pair.slice(0, i) : pair;
      const v = i >= 0 ? pair.slice(i + 1) : "";
      parsed[k] = decodeURIComponent(v);
    });
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(200).end(JSON.stringify({ cookies: parsed }, null, 2));
  } catch (e) {
    res.status(200).end(JSON.stringify({ cookies: {}, note: "parse error", error: String(e) }));
  }
}
