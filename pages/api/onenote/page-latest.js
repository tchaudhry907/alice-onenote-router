// pages/api/onenote/page-latest.js
import { get as kvGet } from "@/lib/kv";
import { ONE_NOTE_INBOX_SECTION_ID } from "@/lib/constants";

async function getAccessTokenFromKV() {
  const blob = await kvGet("msauth:default");
  const token = blob?.access;
  return typeof token === "string" && token.length > 0 ? token : null;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  try {
    const accessToken = await getAccessTokenFromKV();
    if (!accessToken) {
      return res.status(401).json({ ok: false, error: "Not authenticated (no bound access token)" });
    }

    const secId =
      process.env.ONE_NOTE_INBOX_SECTION_ID ||
      ONE_NOTE_INBOX_SECTION_ID ||
      "";
    if (!secId) {
      return res.status(400).json({ ok: false, error: "Inbox section id not configured" });
    }

    const url = `https://graph.microsoft.com/v1.0/me/onenote/sections/${encodeURIComponent(
      secId
    )}/pages?$orderby=lastModifiedDateTime desc&$top=1`;

    const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(400).json({ ok: false, error: j });
    }

    const page = j?.value?.[0];
    if (!page?.id) {
      return res.status(404).json({ ok: false, error: "No pages found" });
    }

    return res.status(200).json({ ok: true, id: page.id, title: page.title ?? null });
  } catch (e) {
    return res.status(400).json({ ok: false, error: String(e) });
  }
}
