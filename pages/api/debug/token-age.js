// pages/api/debug/token-age.js
// Reports "how old" tokens are and (if JWT) the time left until expiry.
// Access tokens for personal Microsoft accounts are opaque; we fall back to "unknown exp".

export default async function handler(req, res) {
  try {
    const now = Math.floor(Date.now() / 1000);
    const access = req.cookies?.access_token || "";
    const refresh = req.cookies?.refresh_token || "";
    const idtok  = req.cookies?.id_token || "";

    const idJwt = decodeJwtSafe(idtok);
    const idExp = idJwt?.exp || null;
    const idIat = idJwt?.iat || null;

    res.status(200).json({
      ok: true,
      server_now_epoch: now,
      // Access/refresh are opaque for MSA; we can't read exp reliably.
      access_token: {
        present: !!access,
        type: access.includes(".") ? "jwt-like" : "opaque",
        // If it is JWT-like (AAD cases), try to show time left:
        ...(access.includes(".") ? jwtTimes(access) : { exp_known: false }),
      },
      refresh_token: { present: !!refresh }, // no exp info exposed
      id_token: {
        present: !!idtok,
        exp: idExp,
        iat: idIat,
        seconds_until_expiry: idExp ? (idExp - now) : null,
      }
    });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e.message || e) });
  }
}

function decodeJwtSafe(tok) {
  if (!tok || tok.split(".").length < 3) return null;
  try {
    const b64 = tok.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(b64, "base64").toString("utf8");
    return JSON.parse(json);
  } catch { return null; }
}
function jwtTimes(tok) {
  const j = decodeJwtSafe(tok);
  if (!j) return { exp_known: false };
  const now = Math.floor(Date.now() / 1000);
  return {
    exp_known: true,
    iat: j.iat || null,
    exp: j.exp || null,
    seconds_until_expiry: j.exp ? (j.exp - now) : null,
  };
}
