// pages/api/onenote/page-latest.js
import { getBoundAccessToken } from "@/lib/auth";
import { ONE_NOTE_INBOX_SECTION_ID } from "@/lib/constants";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  try {
    const accessToken = await getBoundAccessToken();
    if (!accessToken) {
      return res.status(401).json({ ok: false, error: "Not authenticated (no bound access token)" });
    }

    const secId =
      process.env.ONE_NOTE_INBOX_SECTION_ID ||
      ONE_NOTE_INBOX_SECTION_ID ||
      "";

    const url = `https://graph.microsoft.com/v1.0/me/onenote/sections/${encodeURIComponent(
      secId
    )}/pages?$orderby=lastModifiedDateTime desc&$top=1`;

    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(400).json({ ok: false, error: j });
    }

    const page = j?.value?.[0] || null;
    if (!page) {
      return res.status(404).json({ ok: false, error: "No pages found" });
    }

    return res.status(200).json({ ok: true, page });
  } catch (err) {
    return res.status(400).json({ ok: false, error: String(err) });
  }
}
