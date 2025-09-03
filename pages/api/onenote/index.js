// pages/api/onenote/index.js
export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    message: "OneNote API routes are deployed.",
    routes: [
      "/api/onenote",               // this route
      "/api/onenote/page-content",  // GET ?id=<pageId>
      "/api/onenote/append-last"    // POST { html?: string }
    ]
  });
}
