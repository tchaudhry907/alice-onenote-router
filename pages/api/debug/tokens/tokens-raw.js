// pages/api/debug/tokens-raw.js
// Returns RAW tokens from cookies (no masking) if caller presents x-admin-key header.
// This is for owner troubleshooting only.

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const p of header.split(/;\s*/)) {
    const [k, ...v] = p.split("=");
    if (!k) continue;
    out[k.trim()] = decodeURIComponent((v.join("=") || "").trim());
  }
  return out;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const adminKey = process.env.ADMIN_KEY || "";
  const provided = req.headers["x-admin-key"] || req.headers["X-Admin-Key"];

  if (!adminKey) {
    return res.status(500).json({ ok: false, error: "ADMIN_KEY not configured" });
  }
  if (!provided || String(provided).trim() !== adminKey) {
    return res.status(401).json({ ok: false, error: "Unauthorized (missing/invalid x-admin-key)" });
  }

  const cookies = parseCookies(req.headers.cookie || "");
  // Common cookie names used in your app
  const access_token = cookies.access_token || null;
  const refresh_token = cookies.refresh_token || null;
  const id_token = cookies.id_token || null;

  return res.status(200).json({ ok: true, access_token, refresh_token, id_token });
}
