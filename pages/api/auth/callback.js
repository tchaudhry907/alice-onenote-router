// pages/api/auth/callback.js
// Handles OAuth redirect from Microsoft, exchanges code for tokens, saves in KV.

import { exchangeAuthCodeForTokens } from "@/lib/msgraph";

export default async function handler(req, res) {
  const { code, error, error_description } = req.query || {};
  if (error) {
    return res.status(400).json({ ok: false, error, error_description });
  }
  if (!code) {
    return res.status(400).json({ ok: false, error: "Missing code" });
  }

  try {
    const tokens = await exchangeAuthCodeForTokens(String(code));
    // Show a simple success page
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).end(`
      <html><body>
        <h2>Microsoft sign-in complete ✅</h2>
        <p>Refresh token saved. You can close this tab.</p>
        <pre>${JSON.stringify({ expires_at: tokens.expires_at, scope: tokens.scope }, null, 2)}</pre>
      </body></html>
    `);
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
