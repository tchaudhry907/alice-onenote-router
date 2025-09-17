// pages/api/auth/refresh.js
// v2: no redirect — just a JSON no-op so Diagnostics can "refresh" without leaving the page.
export default async function handler(req, res) {
  try {
    // If you later add real refresh logic, do it here.
    // Keeping the response shape stable:
    res.status(200).json({
      ok: true,
      message: "Refresh not required in v2; Diagnostics can proceed.",
    });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e?.message || e) });
  }
}
