import { requireAuth, getAccessToken } from "@/lib/auth";

function htmlToText(html) {
  // very small, dependency-free HTML → text
  try {
    // remove scripts/styles
    html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
    html = html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");

    // convert breaks/headings to newlines (keeps some structure)
    html = html
      .replace(/<(h[1-6]|p|div|li|br|tr|table|section|article|hr)\b[^>]*>/gi, "\n$&");

    // strip tags
    let text = html.replace(/<[^>]+>/g, " ");

    // decode a few entities quickly
    text = text
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&quot;/g, '"');

    // collapse whitespace
    text = text.replace(/\s+\n/g, "\n").replace(/\n\s+/g, "\n");
    text = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

    return text;
  } catch {
    return "";
  }
}

export default requireAuth(async function handler(req, res, session) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { id } = req.query || {};
  if (!id) {
    return res.status(400).json({ ok: false, error: "Missing ?id=" });
  }

  try {
    const accessToken = await getAccessToken(session);
    if (!accessToken) {
      return res.status(401).json({ ok: false, error: "Not authenticated" });
    }

    // Always URL-encode the OneNote page id (the id contains '!' characters)
    const encId = encodeURIComponent(String(id));

    // Ask Graph for the HTML content; includeIDs=true usually keeps element ids
    const url = `https://graph.microsoft.com/v1.0/me/onenote/pages/${encId}/content?includeIDs=true`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const ct = resp.headers.get("content-type") || "";
    const body = await resp.text();

    if (!resp.ok) {
      // Bubble up Graph’s error body to help debugging
      return res
        .status(resp.status)
        .json({ ok: false, error: body || `Graph error ${resp.status}` });
    }

    // If Graph returned HTML, strip it; otherwise just return raw
    const isHtml = ct.includes("text/html") || body.trim().startsWith("<");
    const text = isHtml ? htmlToText(body) : body;

    return res.status(200).json({ ok: true, id, contentType: ct, text });
  } catch (err) {
    const msg =
      typeof err?.message === "string" ? err.message : String(err || "Unknown error");
    return res.status(500).json({ ok: false, error: msg });
  }
});
