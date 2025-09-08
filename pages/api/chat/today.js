// pages/api/chat/today.js
//
// Relay endpoint: GET
// - Refreshes tokens on the server
// - Reads today's latest Daily Log plain text via your existing routes
// - Returns { ok, id, title, text }

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
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

    // 2) Get latest page id + title
    const latestRes = await fetch(`${base}/api/onenote/page-latest`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    const latest = await safeJson(latestRes);

    if (!latestRes.ok || !latest?.ok || !latest?.id) {
      return res.status(500).json({
        ok: false,
        step: "page-latest",
        error: "Failed to get latest page",
        detail: latest || null,
      });
    }

    // 3) Get plain text for that page
    const textRes = await fetch(
      `${base}/api/onenote/page-text?` +
        new URLSearchParams({ id: latest.id }).toString(),
      { method: "GET", headers: { "Content-Type": "application/json" } }
    );

    const textJson = await safeJson(textRes);
    if (!textRes.ok || !textJson?.ok) {
      return res.status(500).json({
        ok: false,
        step: "page-text",
        error: "Failed to fetch page text",
        detail: textJson || null,
      });
    }

    return res.status(200).json({
      ok: true,
      id: latest.id,
      title: latest.title || null,
      text: textJson.text || "",
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
