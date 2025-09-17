// pages/api/auth/refresh.js
// v2: we don't actually need to refresh, but we support ?redirect=... so the UI can bounce back.

export default async function handler(req, res) {
  // Optional redirect back to a page (e.g. /debug/diagnostics)
  const redirect = typeof req.query.redirect === "string" ? req.query.redirect : "";

  // If you later add real refresh logic, do it here, then continue to redirect/JSON below.
  const payload = { ok: true, message: "Refresh not required in v2; use Diagnostics → Refresh Tokens then Seed." };

  if (redirect) {
    // 302 back to the given page so the user doesn’t get stuck on a JSON screen
    res.setHeader("Location", redirect);
    // Send a tiny HTML for safety (some clients require a body)
    return res.status(302).send(`<!doctype html><meta http-equiv="refresh" content="0;url=${redirect}">`);
  }

  // Fallback JSON (when called via fetch)
  return res.status(200).json(payload);
}
