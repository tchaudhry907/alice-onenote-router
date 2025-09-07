// pages/api/debug/tokens.js
// Returns tokens from cookies. By default they are MASKED.
// Pass ?full=1 (or ?full=true) to return the FULL tokens (no ellipses).

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const cookies = parseCookies(req);

  // We support both the "ms_*" cookie names you already have and the "alice_*" names.
  const access =
    cookies.alice_access_token ||
    cookies.ms_access_token ||
    cookies.access_token ||
    null;

  const refresh =
    cookies.alice_refresh_token ||
    cookies.ms_refresh_token ||
    cookies.refresh_token ||
    null;

  const id =
    cookies.alice_id_token || cookies.ms_id_token || cookies.id_token || null;

  const wantFull =
    req.query.full === "1" ||
    req.query.full === "true" ||
    req.query.full === "yes";

  const body = wantFull
    ? { access_token: access, refresh_token: refresh, id_token: id }
    : {
        access_token: mask(access),
        refresh_token: mask(refresh),
        id_token: mask(id),
      };

  return res.status(200).json(body);
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  header.split(/; */).forEach((pair) => {
    if (!pair) return;
    const idx = pair.indexOf("=");
    const k = decodeURIComponent(pair.slice(0, idx).trim());
    const v = decodeURIComponent(pair.slice(idx + 1).trim());
    out[k] = v;
  });
  return out;
}

function mask(t) {
  if (!t) return null;
  if (t.length <= 12) return t;
  return `${t.slice(0, 6)}…${t.slice(-6)}`;
}
