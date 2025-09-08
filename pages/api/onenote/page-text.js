// pages/api/onenote/page-text.js
import { get as kvGet } from "@/lib/kv";

/**
 * Simple HTML -> text utility tuned for OneNote
 */
function htmlToText(html = "") {
  // Drop scripts/styles
  html = html.replace(/<script[\s\S]*?<\/script>/gi, "")
             .replace(/<style[\s\S]*?<\/style>/gi, "");

  // Normalize line breaks for block-ish tags
  html = html
    .replace(/<(br|br\/)\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<\/li>/gi, "\n");

  // Strip remaining tags
  let text = html.replace(/<\/?[^>]+>/g, "");

  // Decode a few common entities
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');

  // Collapse multiple blank lines
  text = text.replace(/\r/g, "").split("\n").map(l => l.trimEnd()).join("\n");
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  // Deduplicate the common "Daily Log — YYYY-MM-DD" header if it repeats
  const lines = text.split("\n").map(s => s.trim()).filter(Boolean);
  if (lines.length >= 2 && lines[0] === lines[1]) {
    lines.splice(1, 1);
  }
  return lines.join("\n");
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { id } = req.query || {};
  if (!id || typeof id !== "string") {
    return res.status(400).json({ ok: false, error: "Missing ?id" });
  }

  try {
    // Pull access token from KV (same place diagnostics showed)
    const stored = await kvGet("msauth:default");
    const accessToken = stored?.access;
    if (!accessToken) {
      return res.status(401).json({ ok: false, error: "Not authenticated" });
    }

    // Fetch raw HTML content from Graph
    const url = `https://graph.microsoft.com/v1.0/me/onenote/pages/${encodeURIComponent(
      id
    )}/content`;

    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // If token went stale, surface Graph’s error
    if (!r.ok) {
      const body = await r.text();
      return res.status(r.status).json({ ok: false, error: body || "Graph error" });
    }

    const html = await r.text();
    const text = htmlToText(html);

    return res.status(200).json({
      ok: true,
      id,
      length: text.length,
      text,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
