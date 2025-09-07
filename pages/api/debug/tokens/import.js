// pages/api/debug/tokens/import.js
//
// Debug endpoint to stuff MS tokens into the server session cookies so
// /api/cron/bind and the rest of the app can see them.
//
// POST JSON:
// { "access_token": "...", "refresh_token": "...", "id_token": "..." }

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { access_token, refresh_token, id_token } = req.body || {};

    if (!refresh_token) {
      return res.status(400).json({
        ok: false,
        error:
          "Missing refresh_token in body. Provide { access_token, refresh_token, id_token }.",
      });
    }

    // 1) Write httpOnly cookies the rest of the app already looks for.
    //    Names chosen to match our diagnostics & auth utilities:
    //    ms_access_token, ms_refresh_token, ms_id_token
    const cookieBits = [];

    // helper to build Set-Cookie
    const makeCookie = (name, value, days) => {
      const expires = new Date(Date.now() + days * 86400 * 1000).toUTCString();
      return `${name}=${encodeURIComponent(
        value
      )}; Path=/; HttpOnly; SameSite=Lax; Secure; Expires=${expires}`;
    };

    if (access_token) cookieBits.push(makeCookie("ms_access_token", access_token, 1));
    // give refresh token a long-ish lifetime (90 days)
    cookieBits.push(makeCookie("ms_refresh_token", refresh_token, 90));
    if (id_token) cookieBits.push(makeCookie("ms_id_token", id_token, 1));

    res.setHeader("Set-Cookie", cookieBits);

    return res.status(200).json({
      ok: true,
      message: "Tokens imported to session cookies.",
      wrote: {
        ms_access_token: !!access_token,
        ms_refresh_token: true,
        ms_id_token: !!id_token,
      },
    });
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, error: "Unexpected error", detail: String(err) });
  }
}
