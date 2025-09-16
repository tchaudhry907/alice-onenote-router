// pages/api/auth/token-age.js
// Reports age/expiry for access_token and id_token (JWTs) from header or cookie.

export default async function handler(req, res) {
  try {
    const bearer =
      req.headers.authorization ||
      (req.cookies?.access_token ? `Bearer ${req.cookies.access_token}` : "");

    const rawAccess = readRawToken(bearer) || req.cookies?.access_token || "";
    const rawId = req.cookies?.id_token || "";

    const now = Math.floor(Date.now() / 1000);

    const accessInfo = parseJwtInfo(rawAccess, now);
    const idInfo = parseJwtInfo(rawId, now);

    return res.status(200).json({
      ok: true,
      nowEpoch: now,
      access_token: accessInfo,
      id_token: idInfo,
      // refresh_token usually isn't a JWT; expiry is server-side/conditional
      note: "refresh_token lifetime is controlled by Microsoft and not decodeable here",
    });
  } catch (e) {
    return res
      .status(200)
      .json({ ok: false, error: String(e?.message || e) });
  }
}

function readRawToken(bearer) {
  if (!bearer) return "";
  const m = String(bearer).match(/Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

function parseJwtInfo(token, now) {
  if (!token) return { present: false };
  // JWT must have 2 dots: header.payload.signature
  if ((token.match(/\./g) || []).length !== 2) {
    return { present: true, jwt: false, error: "Not a compact JWT (no two dots)" };
  }
  try {
    const payload = JSON.parse(base64UrlDecode(token.split(".")[1] || ""));
    const iat = num(payload.iat);
    const exp = num(payload.exp);
    const ttl = exp ? Math.max(0, exp - now) : null;

    return {
      present: true,
      jwt: true,
      iat,
      exp,
      expiresAtISO: exp ? new Date(exp * 1000).toISOString() : null,
      issuedAtISO: iat ? new Date(iat * 1000).toISOString() : null,
      ttlSeconds: ttl,
      ttlHuman: ttl != null ? human(ttl) : null,
    };
  } catch (e) {
    return { present: true, jwt: false, error: "Decode failed: " + String(e?.message || e) };
  }
}

function base64UrlDecode(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = 4 - (s.length % 4 || 4);
  return Buffer.from(s + "=".repeat(pad), "base64").toString("utf8");
}

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function human(secs) {
  if (secs <= 0) return "expired";
  const m = Math.floor(secs / 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h >= 1) return `${h}h ${mm}m`;
  return `${m}m`;
}
