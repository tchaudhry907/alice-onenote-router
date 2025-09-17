// lib/graph.js
export function isJwt(x) {
  return typeof x === "string" && x.split(".").length === 3;
}

export function decodeJwtUnsafe(x) {
  try {
    const [, payload] = x.split(".");
    return JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  } catch {
    return null;
  }
}

export function readCookie(req, name) {
  return req.cookies?.[name] || "";
}

export function setCookie(res, name, value, maxAgeSec = 60 * 60 * 24 * 30) {
  // httpOnly so JS can’t read; Path=/ so it’s available to all routes.
  const cookie = `${name}=${encodeURIComponent(value || "")}; Path=/; Max-Age=${maxAgeSec}; HttpOnly; SameSite=Lax`;
  res.setHeader("Set-Cookie", [cookie].concat(res.getHeader("Set-Cookie") || []));
}

export async function exchangeRefreshTokenForGraph(refreshToken) {
  if (!refreshToken) throw new Error("No refresh_token available");

  // Microsoft consumer tenant (OneDrive personal)
  const tokenUrl = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";

  const params = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID || "",
    client_secret: process.env.MS_CLIENT_SECRET || process.env.MICROSOFT_CLIENT_SECRET || "",
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    // ask for Graph-scoped token
    scope: "https://graph.microsoft.com/.default offline_access openid profile",
  });

  const r = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const j = await r.json();
  if (!r.ok) {
    throw new Error(`token refresh failed ${r.status}: ${JSON.stringify(j)}`);
  }
  return j; // { access_token, refresh_token?, id_token, expires_in, ... }
}

/**
 * Ensure we have a *Graph* access token.
 * If current cookie access_token is not a JWT or points at the wrong audience,
 * we’ll use the refresh_token to mint a proper Graph token and set cookies.
 * Returns { access_token, refresh_token, id_token, info }
 */
export async function ensureGraphAccessToken(req, res) {
  let access_token = readCookie(req, "access_token");
  let refresh_token = readCookie(req, "refresh_token");
  let id_token = readCookie(req, "id_token");

  let reason = "";

  // If not a JWT, or aud != graph, or clearly the old opaque token — refresh.
  const looksJwt = isJwt(access_token);
  if (looksJwt) {
    const payload = decodeJwtUnsafe(access_token) || {};
    const aud = payload.aud || payload.appid || "";
    const scp = payload.scp || "";
    const tid = payload.tid || "";
    // quick heuristics: we want a Graph token (aud usually "https://graph.microsoft.com")
    const okAud = typeof aud === "string" && aud.toLowerCase().includes("graph");
    const okScp = typeof scp === "string" && (scp.includes("Notes.") || scp.includes("AllSites.") || scp.includes("Files."));
    if (!okAud && !okScp) {
      reason = `refresh: bad audience (aud=${aud || "n/a"})`;
    }
  } else {
    reason = "refresh: access_token not a JWT";
  }

  if (reason) {
    const j = await exchangeRefreshTokenForGraph(refresh_token);
    access_token = j.access_token || access_token;
    refresh_token = j.refresh_token || refresh_token;
    id_token = j.id_token || id_token;

    setCookie(res, "access_token", access_token);
    if (refresh_token) setCookie(res, "refresh_token", refresh_token);
    if (id_token) setCookie(res, "id_token", id_token);
  }

  return {
    access_token,
    refresh_token,
    id_token,
    info: {
      refreshed: Boolean(reason),
      reason,
      access_is_jwt: isJwt(access_token),
    },
  };
}
