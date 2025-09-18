// pages/api/log/index.js
// Prime Directive logger: classify free text -> sectionId/title/html -> fast create (no list calls).

import { routeText } from "@/lib/router";
import { resolveSectionId } from "@/lib/sections";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  try {
    const { text } = req.body || {};
    if (!text || String(text).trim().length === 0) {
      return res.status(400).json({ ok: false, error: "Missing text" });
    }

    const routed = routeText(text);
    if (!routed?.sectionId) {
      return res.status(404).json({ ok: false, error: `Section not found for "${routed?.sectionName}"` });
    }

    // Call our own fast creator (stays within the deployment)
    const base = `${(req.headers["x-forwarded-proto"] || "https")}://${req.headers.host}`;
    const r = await fetch(`${base}/api/onenote/create-fast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sectionId: routed.sectionId,
        title: routed.title,
        html: routed.html,
      }),
      cache: "no-store",
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(r.status).json({ ok: false, error: data?.error || "Create failed" });
    }
    return res.status(200).json({ ok: true, routed, page: data.page });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || "Internal Error" });
  }
}
