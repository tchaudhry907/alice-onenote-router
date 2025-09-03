// pages/api/auth/callback.js
import { exchangeCodeForTokens } from "@/lib/graph";
import { kv } from "@/lib/kv";
import { setTokenCookie } from "@/lib/cookie";

export default async function handler(req, res) {
  try {
    const { code, error, error_description } = req.query || {};
    if (error) throw new Error(`${error}: ${error_description}`);
    if (!code) throw new Error("Missing code");

    const tokens = await exchangeCodeForTokens(code);
    const idToken = tokens.id_token;
    if (!idToken) throw new Error("Missing id_token");

    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64").toString("utf8"));
    const oid = payload.oid || payload.sub;
    const tid = payload.tid || process.env.MS_TENANT || "common";
    const redisKey = `msrt:${tid}:${oid}`;

    if (tokens.refresh_token) {
      await kv.set(redisKey, tokens.refresh_token, { ex: 60 * 60 * 24 * 180 });
      // remember "who signed in last", for worker fallback
      await kv.set("alice:lastUserKey", redisKey, { ex: 60 * 60 * 24 * 180 });
      // optional: store a service token so cron can run without a user session
      await kv.set("alice:service:refreshToken", tokens.refresh_token, { ex: 60 * 60 * 24 * 180 });
    }

    setTokenCookie(res, { key: redisKey, access_token: tokens.access_token || null });
    res.writeHead(302, { Location: "/login-success" }).end();
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e.message || e) });
  }
}
