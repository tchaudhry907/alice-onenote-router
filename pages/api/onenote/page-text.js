// pages/api/onenote/page-text.js
import { getBoundAccessToken } from "@/lib/auth";

function htmlToPlain(html = "") {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default async function handler(req, res) {
  const { id } = req.query || {};
  if (!id) return res.status(400).json({ ok: false, error: "Missing id" });

  try {
    const accessToken = await getBoundAccessToken();
    if (!accessToken) {
      return res.status(401).json({ ok: false, error: "Not authenticated (no bound access token)" });
    }

    const url = `https://graph.microsoft.com/v1.0/me/onenote/pages/${encodeURIComponent(
      id
    )}/content?includeIDs=true`;

    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const html = await r.text();
    if (!r.ok) {
      return res.status(400).json({ ok: false, error: html });
    }

    return res.status(200).json({
      ok: true,
      id,
      text: htmlToPlain(html),
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: String(err) });
  }
}
