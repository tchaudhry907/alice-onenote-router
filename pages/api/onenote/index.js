// pages/api/onenote/index.js
export default function handler(req, res) {
  try {
    // Minimal response to prove the folder route is live.
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(200).end(JSON.stringify({
      ok: true,
      message: "OneNote API routes are deployed.",
      routes: [
        "/api/onenote",               // this route
        "/api/onenote/page-content",  // GET ?id=<pageId> (URL-encoded)
        "/api/onenote/append-last"    // POST { html?: string }
      ]
    }));
  } catch (e) {
    res.status(500).end(JSON.stringify({ ok: false, error: String(e?.message || e) }));
  }
}
