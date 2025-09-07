import { requireAuth } from "@/lib/auth";
import { get as kvGet } from "@/lib/kv";

function makeSnippet(fullText, query, radius = 60) {
  const i = fullText.toLowerCase().indexOf(query.toLowerCase());
  if (i < 0) return fullText.slice(0, 120);
  const start = Math.max(0, i - radius);
  const end = Math.min(fullText.length, i + query.length + radius);
  const before = start > 0 ? "…" : "";
  const after = end < fullText.length ? "…" : "";
  return before + fullText.slice(start, end) + after;
}

export default requireAuth(async function handler(req, res, _session) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { q, limit } = req.body || {};
    const query = String(q || "").trim();
    if (!query) return res.status(400).json({ ok: false, error: "Missing q" });

    const indexKey = "idx:list";
    const list = (await kvGet(indexKey)) || [];
    if (!list.length) {
      return res.status(400).json({ ok: false, error: "Cache empty" });
    }

    const results = [];
    for (const pageId of list) {
      const text = (await kvGet(`idx:text:${pageId}`)) || "";
      if (!text) continue;
      if (text.toLowerCase().includes(query.toLowerCase())) {
        results.push({
          pageId,
          snippet: makeSnippet(text, query),
        });
        if (results.length >= (Number(limit) || 10)) break;
      }
    }

    return res.status(200).json({ ok: true, hits: results });
  } catch (err) {
    return res.status(400).json({ ok: false, error: "Search failed", detail: String(err) });
  }
});
