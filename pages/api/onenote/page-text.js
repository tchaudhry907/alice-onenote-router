// pages/api/onenote/page-text.js
import { requireAuth, getAccessToken } from "@/lib/auth";

/**
 * Fetches the raw HTML of a OneNote page via Microsoft Graph and returns a plain-text extraction.
 * We call Graph directly:
 *   GET https://graph.microsoft.com/v1.0/me/onenote/pages/{id}/content?includeIDs=true
 *
 * Returns: { ok: true, id, title?, text, bytes }
 */
function htmlToPlainText(html = "") {
  try {
    // Remove scripts/styles
    html = html.replace(/<script[\s\S]*?<\/script>/gi, "");
    html = html.replace(/<style[\s\S]*?<\/style>/gi, "");
    // Replace <br> and block tags with newlines
    html = html.replace(/<(?:br|BR)\s*\/?>/g, "\n");
    html = html.replace(/<\/(p|div|h[1-6]|li|ul|ol|table|tr|td|th)>/gi, "\n");
    // Strip the rest of tags
    html = html.replace(/<[^>]+>/g, "");
    // Decode minimal entities
    html = html
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    // Collapse excessive whitespace
    html = html.replace(/\r/g, "");
    html = html.replace(/\n{3,}/g, "\n\n");
    html = html.trim();
    return html;
  } catch {
    return "";
  }
}

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

    // IMPORTANT: call Graph content endpoint directly (NOT the web link)
    const url = `https://graph.microsoft.com/v1.0/me/onenote/pages/${encodeURIComponent(
      id
    )}/content?includeIDs=true`;

    const r = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        // Let Graph return HTML; do NOT follow OneDrive web redirects
        Accept: "text/html",
      },
    });

    const raw = await r.text().catch(() => "");
    if (!r.ok) {
      return res
        .status(r.status)
        .json({ ok: false, error: raw || `(status ${r.status})` });
    }

    const text = htmlToPlainText(raw);
    return res.status(200).json({
      ok: true,
      id,
      text,
      bytes: raw.length,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error:
        typeof err?.message === "string" ? err.message : "Unhandled server error",
    });
  }
});
