// pages/api/onenote/page-text.js
import { get as kvGet } from "@/lib/kv";

async function getAccessTokenFromKV() {
  const blob = await kvGet("msauth:default");
  const token = blob?.access;
  return typeof token === "string" && token.length > 0 ? token : null;
}

function stripHtml(html = "") {
  // very basic conversion; keeps newlines around block tags
  return html
    .replace(/<\/(p|div|h[1-6]|li|br|tr)>/gi, "$&\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  try {
    const id = String(req.query.id || "");
    if (!id) return res.status(400).json({ ok: false, error: "Missing id" });

    const accessToken = await getAccessTokenFromKV();
    if (!accessToken) {
      return res.status(401).json({ ok: false, error: "Not authenticated (no bound access token)" });
    }

    const url = `https://graph.microsoft.com/v1.0/me/onenote/pages/${encodeURIComponent(id)}/content?includeIDs=true`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const html = await r.text();
    if (!r.ok) {
      return res.status(400).json({ ok: false, error: html || "(no body)" });
    }

    return res.status(200).json({ ok: true, id, text: stripHtml(html) });
  } catch (e) {
    return res.status(400).json({ ok: false, error: String(e) });
  }
}
