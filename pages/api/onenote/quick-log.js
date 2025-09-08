// pages/api/onenote/page-text-latest.js
import { get as kvGet } from "@/lib/kv";

function htmlToText(html = "") {
  html = html.replace(/<script[\s\S]*?<\/script>/gi, "")
             .replace(/<style[\s\S]*?<\/style>/gi, "");
  html = html
    .replace(/<(br|br\/)\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<\/li>/gi, "\n");
  let text = html.replace(/<\/?[^>]+>/g, "");
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
  text = text.replace(/\r/g, "").split("\n").map(l => l.trimEnd()).join("\n");
  text = text.replace(/\n{3,}/g, "\n\n").trim();
  const lines = text.split("\n").map(s => s.trim()).filter(Boolean);
  if (lines.length >= 2 && lines[0] === lines[1]) lines.splice(1, 1);
  return lines.join("\n");
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const stored = await kvGet("msauth:default");
    const accessToken = stored?.access;
    if (!accessToken) {
      return res.status(401).json({ ok: false, error: "Not authenticated" });
    }

    // Get most recent page id
    const listUrl =
      "https://graph.microsoft.com/v1.0/me/onenote/pages?$top=1&orderby=lastModifiedDateTime%20desc&select=id,title,lastModifiedDateTime";
    const listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!listRes.ok) {
      const body = await listRes.text();
      return res.status(listRes.status).json({ ok: false, error: body || "Graph list error" });
    }
    const j = await listRes.json();
    const item = j?.value?.[0];
    if (!item?.id) {
      return res.status(404).json({ ok: false, error: "No pages found" });
    }

    const id = item.id;

    // Fetch its HTML
    const contentUrl = `https://graph.microsoft.com/v1.0/me/onenote/pages/${encodeURIComponent(
      id
    )}/content`;
    const r = await fetch(contentUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) {
      const body = await r.text();
      return res.status(r.status).json({ ok: false, error: body || "Graph content error" });
    }
    const html = await r.text();
    const text = htmlToText(html);

    return res.status(200).json({
      ok: true,
      id,
      title: item.title,
      lastModifiedDateTime: item.lastModifiedDateTime,
      length: text.length,
      text,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
