// pages/api/onenote/append-last.js
import { kv } from "@/lib/kv";
import { refreshAccessToken } from "@/lib/graph";
import { getTokenCookie } from "@/lib/cookie";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "Use POST" });
    }

    const tok = getTokenCookie(req);
    if (!tok?.key) return res.status(401).json({ ok: false, error: "Not authenticated" });
    const refreshToken = await kv.get(tok.key);
    if (!refreshToken) return res.status(401).json({ ok: false, error: "Session expired. Sign in again." });

    const pageId = await kv.get("alice:lastPageId");
    if (!pageId) return res.status(400).json({ ok: false, error: "No last page id found" });

    const { html } = await readJson(req);

    const fresh = await refreshAccessToken(refreshToken);
    const url = `https://graph.microsoft.com/v1.0/me/onenote/pages/${encodeURIComponent(pageId)}/content`;
    const commands = [
      { target: "body", action: "append", position: "after", content: html || `<p>Appended via append-last at ${new Date().toISOString()}</p>` }
    ];

    const r = await fetch(url, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${fresh.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify(commands)
    });

    const text = await r.text();
    res.status(r.status).send(text);
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  try { return JSON.parse(raw || "{}"); } catch { return {}; }
}
