// pages/api/debug/tokens/tokens-raw.js
//
// Purpose: Return the RAW tokens so you can copy a real access_token (with dots) for curl testing.
// Security: Require ?admin_key=... to avoid exposing tokens publicly.
//
// Usage:
//   GET /api/debug/tokens/tokens-raw?admin_key=YOUR_ADMIN_KEY
// Response:
//   { access_token: "...", refresh_token: "...", id_token: "..." }
//
// Notes:
// - We do NOT depend on next-auth. We only read from request cookies.
// - If your app also stores tokens in memory/kv, you can augment the reads below.

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const adminKey = process.env.ADMIN_KEY || process.env.ADMIN_SECRET || "";
  const supplied = (req.query.admin_key || req.headers["x-admin-key"] || "").toString();

  if (!adminKey) {
    return res.status(500).json({ ok: false, error: "ADMIN_KEY not set on server" });
  }
  if (!supplied || supplied !== adminKey) {
    return res.status(401).json({ ok: false, error: "Unauthorized: admin_key missing or invalid" });
  }

  // Basic cookie parser (no deps)
  const cookieHeader = req.headers.cookie || "";
  const jar = Object.fromEntries(
    cookieHeader
      .split(";")
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        const i = p.indexOf("=");
        const k = i >= 0 ? p.slice(0, i) : p;
        const v = i >= 0 ? decodeURIComponent(p.slice(i + 1)) : "";
        return [k, v];
      })
  );

  const access_token = jar["access_token"] || null;
  const refresh_token = jar["refresh_token"] || null;
  const id_token = jar["id_token"] || null;

  return res.status(200).json({ access_token, refresh_token, id_token });
}
