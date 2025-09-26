// pages/api/onenote/search.js
import { graphFetch, exchangeRefreshToken } from "@/lib/msgraph.js";

/**
 * GET /api/onenote/search?accessToken=...&q=...
 * or POST with { accessToken?, refreshToken?, q }
 * If refreshToken is provided but no accessToken, we attempt token exchange.
 */
export default async function handler(req, res) {
  try {
    let { accessToken, q, refreshToken } =
      req.method === "GET" ? req.query : req.body || {};

    if (!accessToken && refreshToken) {
      const tokens = await exchangeRefreshToken(refreshToken);
      accessToken = tokens.access_token;
    }

    if (!accessToken) {
      return res.status(400).json({ ok: false, error: "Missing accessToken (or refreshToken)" });
    }
    if (!q) {
      return res.status(400).json({ ok: false, error: "Missing query param q" });
    }

    const url = `https://graph.microsoft.com/v1.0/me/onenote/pages?$search="${q}"`;
    const data = await graphFetch(accessToken, url, { method: "GET" });
    return res.status(200).json({ ok: true, data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
