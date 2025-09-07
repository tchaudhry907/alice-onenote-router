// pages/api/onenote/page-content.js
import { requireAuth, getAccessToken } from "@/lib/auth";

/**
 * Returns the raw HTML content of a OneNote page via Microsoft Graph.
 *   GET /api/onenote/page-content?id=<PAGE_ID>
 *   or POST with { id }
 */
export default requireAuth(async function handler(req, res, session) {
  try {
    const id =
      req.method === "GET"
        ? req.query?.id
        : (req.body && req.body.id) || req.query?.id;

    if (!id || typeof id !== "string") {
      return res
        .status(400)
        .json({ ok: false, error: "Missing required 'id' parameter" });
    }

    const accessToken = await getAccessToken(session);
    const url = `https://graph.microsoft.com/v1.0/me/onenote/pages/${encodeURIComponent(
      id
    )}/content?includeIDs=true`;

    const r = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "text/html",
      },
    });

    const raw = await r.text().catch(() => "");
    if (!r.ok) {
      return res
        .status(r.status)
        .json({ ok: false, error: raw || `(status ${r.status})` });
    }

    // Return as text/html so you can view it in browser if you wish
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(raw);
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error:
        typeof err?.message === "string" ? err.message : "Unhandled server error",
    });
  }
});
