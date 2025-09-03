import { exchangeCodeForTokens } from "@/lib/graph";
import { kv } from "@/lib/kv";
import { setTokenCookie } from "@/lib/cookie";

export default async function handler(req, res) {
  try {
    const { code, error, error_description } = req.query || {};
    if (error) throw new Error(`${error}: ${error_description}`);
    if (!code) throw new Error("Missing code");

    const tokens = await exchangeCodeForTokens(code);
    // Parse id_token to identify user (tenant + object id)
    const idToken = tokens.id_token;
    if (!idToken) throw new Error("Missing id_token from Microsoft");

    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64").toString());
    const oid = payload.oid || payload.sub;
    const tid = payload.tid || process.env.MS_TENANT || "common";
    const redisKey = `msrt:${tid}:${oid}`;

    // Store/rotate refresh token in Redis (long TTL ~ 180 days)
    if (tokens.refresh_token) {
      await kv.set(redisKey, tokens.refresh_token, { ex: 60 * 60 * 24 * 180 });
    }

    // Put a tiny cookie that contains the redis key + a short-lived access token to start
    setTokenCookie(res, { key: redisKey, access_token: tokens.access_token });

    // Redirect to a simple OK page (or your app landing)
    const base = process.env.APP_BASE_URL || "";
    res.writeHead(302, { Location: `${base}/api/ok` }).end();
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e.message || e) });
  }
}
