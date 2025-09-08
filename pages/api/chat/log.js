// pages/api/chat/log.js
//
// Relay endpoint: POST { text: "..." }
// - Refreshes tokens on the server
// - Calls your existing /api/onenote/quick-log to write to the Daily Log
// - Returns { ok, pageId, title } on success

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { text } = (req.body || {});
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ ok: false, error: "Missing text" });
    }

    const base = resolveBaseUrl(req);

    // 1) Ensure server has fresh tokens (uses KV on the server)
    const refreshRes = await fetch(`${base}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!refreshRes.ok) {
      const body = await safeJson(refreshRes);
      return res.status(500).json({
        ok: false,
        step: "refresh",
        error: "Failed to refresh tokens",
        detail: body,
      });
    }

    // 2) Append the line to today's Daily Log
    const logRes = await fetch(`${base}/api/onenote/quick-log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    const out = await safeJson(logRes);

    if (!logRes.ok || !out?.ok) {
      return res.status(500).json({
        ok: false,
        step: "quick-log",
        error: "Append failed",
        detail: out || null,
      });
    }

    // Success
    // e.g. { ok:true, pageId:"...", title:"Daily Log — YYYY-MM-DD" }
    // Normalize shape just in case
    return res.status(200).json({
      ok: true,
      pageId: out.pageId || null,
      title: out.title || null,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "Unhandled error",
      detail: String(err?.message || err),
    });
  }
}

function resolveBaseUrl(req) {
  // Prefer explicit env, then Vercel URL, then request host, then localhost (dev)
  const fromEnv =
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

  if (fromEnv) return fromEnv;

  const host =
    req?.headers?.["x-forwarded-host"] ||
    req?.headers?.host ||
    "localhost:3000";

  const proto =
    req?.headers?.["x-forwarded-proto"] ||
    (host.includes("localhost") ? "http" : "https");

  return `${proto}://${host}`;
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    try {
      const t = await res.text();
      return { text: t };
    } catch {
      return null;
    }
  }
}
