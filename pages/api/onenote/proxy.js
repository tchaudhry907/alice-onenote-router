import { kv } from "@/lib/kv";
import { refreshAccessToken, graphRequest } from "@/lib/graph";
import { getTokenCookie } from "@/lib/cookie";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "Use POST" });
    }

    const { path, method = "GET", body, headers } = req.body || {};
    if (!path || !path.startsWith("/me/onenote")) {
      return res.status(400).json({ ok: false, error: "Invalid path (must start with /me/onenote)" });
    }

    // Identify user from cookie
    const tok = getTokenCookie(req);
    const redisKey = tok?.key;
    if (!redisKey) return res.status(401).json({ ok: false, error: "Not authenticated" });

    const refreshToken = await kv.get(redisKey);
    if (!refreshToken) return res.status(401).json({ ok: false, error: "Session expired. Please log in again." });

    // Get fresh access token on every call
    const r = await refreshAccessToken(refreshToken);
    const access = r.access_token;
    if (!access) throw new Error("No access_token from refresh");

    const gRes = await graphRequest(access, path, method, body, headers);
    const text = await gRes.text();
    res.status(gRes.status).send(text);
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
