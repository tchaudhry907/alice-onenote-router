// pages/api/onenote/page-create.js
// Create a OneNote page (no file) in your default section.

import { requireAuth } from "@/lib/auth";
import { kv } from "@/lib/kv";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Use POST" });
  }

  const auth = await requireAuth(req, res);
  if (!auth) return;

  try {
    const raw = await readBody(req);
    let data = {};
    try { data = JSON.parse(raw || "{}"); } catch {}
    const title = data.title || "Alice Router — Upload";
    const body = data.body || "<p>Hello from Alice Router!</p>";

    const sectionId = process.env.DEFAULT_SECTION_ID;
    if (!sectionId) {
      return res.status(500).json({ ok: false, error: "DEFAULT_SECTION_ID not set" });
    }

    // OneNote accepts XHTML for simple page creation (no attachment).
    const xhtml =
      `<!DOCTYPE html><html><head><title>${escapeHtml(title)}</title></head>` +
      `<body>${body}</body></html>`;

    const url = `https://graph.microsoft.com/v1.0/me/onenote/sections/${encodeURIComponent(sectionId)}/pages`;
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        "Content-Type": "application/xhtml+xml",
      },
      body: xhtml,
    });

    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch {}

    // Save lastPageId for follow-up actions
    if (r.status === 201 && json?.id) {
      await kv.set("alice:lastPageId", json.id, { ex: 60 * 60 * 24 * 30 }); // 30d
    }

    res.status(r.status).send(json ?? text);
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

function escapeHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}
