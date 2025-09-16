// pages/api/auth/refresh.js
// v2: tokens are handled by Diagnostics + cookie seeding; this route just replies OK.
export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Use GET or POST" });
  }
  return res.status(200).json({
    ok: true,
    message: "Refresh not required in v2; use Diagnostics → Refresh Tokens then Seed.",
  });
}
