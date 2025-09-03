// pages/api/queue/append.js
import { kv } from "@/lib/kv";
import { getTokenCookie } from "@/lib/cookie";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "Use POST" });
    }

    // optional: require session
    const tok = getTokenCookie(req);
    if (!tok?.key) return res.status(401).json({ ok: false, error: "Not authenticated" });

    const { pageId, html } = await readJson(req);
    const pid = pageId || (await kv.get("alice:lastPageId"));
    if (!pid) return res.status(400).json({ ok: false, error: "No pageId provided and no lastPageId found" });

    const job = {
      kind: "append",
      pageId: pid,
      html: html || `<p><i>Appended by Alice queue at ${new Date().toISOString()}</i></p>`,
      enqueuedAt: Date.now()
    };

    await kv.lpush?.("alice:append:queue", JSON.stringify(job));
    res.status(200).json({ ok: true, queued: job });
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
