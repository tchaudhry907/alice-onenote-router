// pages/api/debug/tokens.js
import { ensureGraphAccessToken, isJwt } from "@/lib/graph";

function mask(s) {
  if (!s) return "";
  if (s.length <= 12) return s;
  return s.slice(0, 6) + "…" + s.slice(-6);
}

export default async function handler(req, res) {
  try {
    const full = (req.query.full || "").toString() === "1";
    const ensure = full || (req.query.ensure || "").toString() === "1";

    let tokens;
    if (ensure) {
      tokens = await ensureGraphAccessToken(req, res); // refresh to Graph if needed
    } else {
      // just echo cookies
      tokens = {
        access_token: req.cookies?.access_token || "",
        refresh_token: req.cookies?.refresh_token || "",
        id_token: req.cookies?.id_token || "",
        info: { refreshed: false, reason: "", access_is_jwt: isJwt(req.cookies?.access_token || "") },
      };
    }

    const payload = full
      ? tokens
      : {
          access_token: mask(tokens.access_token),
          refresh_token: mask(tokens.refresh_token),
          id_token: mask(tokens.id_token),
          info: tokens.info,
        };

    // Helpful metadata
    const meta = {
      access_len: (tokens.access_token || "").length,
      access_starts: (tokens.access_token || "").slice(0, 30),
      access_is_jwt: isJwt(tokens.access_token || ""),
    };

    res.status(200).json({ ok: true, ...payload, meta });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e.message || e) });
  }
}
