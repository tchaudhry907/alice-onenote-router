// pages/api/cron/bind.js
/**
 * Binds the currently signed-in Microsoft account by copying tokens from
 * httpOnly cookies into your Redis store (Upstash).
 *
 * It expects cookies named:
 *   - refresh_token  (required)
 *   - access_token   (optional; stored if present)
 *   - id_token       (optional; stored if present)
 *
 * Env needed (any ONE of these backends is enough; Upstash recommended):
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 *
 * Optional:
 *   BIND_KEY_PREFIX  (default: "msauth:")
 *   BIND_TTL_SECONDS (default: 2592000  -> 30 days)
 *
 * Response:
 *   { ok: true, stored: {refresh:true, access:true/false, id:true/false}, key: "<redis key>" }
 */

import cookie from "cookie";

const json = (res, code, body) => {
  res.status(code).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body, null, 2));
};

async function upstashSet(url, token, key, value, ttlSeconds) {
  // Upstash REST SET with EX
  // Docs: https://docs.upstash.com/redis/features/restapi#commands
  const path = new URL(
    `set/${encodeURIComponent(key)}/${encodeURIComponent(value)}` +
      (ttlSeconds ? `/ex/${ttlSeconds}` : ""),
    ensureTrailingSlash(url)
  );

  const r = await fetch(path.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!r.ok) {
    const t = await safeText(r);
    throw new Error(
      `Upstash SET failed (${r.status}): ${t || r.statusText || "unknown"}`
    );
  }
  return true;
}

function ensureTrailingSlash(u) {
  return u.endsWith("/") ? u : `${u}/`;
}

async function safeText(r) {
  try {
    return await r.text();
  } catch {
    return "";
  }
}

export default async function handler(req, res) {
  try {
    // Parse cookies from request
    const parsed =
      cookie.parse(req.headers.cookie || "") || Object.create(null);

    const refreshToken =
      parsed.refresh_token || parsed.ms_refresh_token || null;
    const accessToken = parsed.access_token || null;
    const idToken = parsed.id_token || null;

    if (!refreshToken) {
      // Helpful debug: show the cookie names we actually received
      const cookieNames = Object.keys(parsed);
      return json(res, 400, {
        ok: false,
        error: "No refresh token found on cookies",
        hint:
          "Make sure you completed /api/auth/login -> /api/auth/callback and you can see tokens on /debug/diagnostics",
        seen_cookie_names: cookieNames,
      });
    }

    // Determine storage (Upstash Redis)
    const U_URL = process.env.UPSTASH_REDIS_REST_URL;
    const U_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!U_URL || !U_TOKEN) {
      return json(res, 500, {
        ok: false,
        error:
          "Redis not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel env.",
      });
    }

    const prefix = process.env.BIND_KEY_PREFIX || "msauth:";
    const ttl = Number(process.env.BIND_TTL_SECONDS || 60 * 60 * 24 * 30); // 30 days
    const keyBase = `${prefix}default`; // You could switch to a user-specific key if desired.

    // Store refresh token (required)
    await upstashSet(U_URL, U_TOKEN, `${keyBase}:refresh_token`, refreshToken, ttl);

    // Optionally store others for debugging/convenience
    let storedAccess = false;
    let storedId = false;
    if (accessToken) {
      await upstashSet(U_URL, U_TOKEN, `${keyBase}:access_token`, accessToken, Math.min(ttl, 3600));
      storedAccess = true;
    }
    if (idToken) {
      await upstashSet(U_URL, U_TOKEN, `${keyBase}:id_token`, idToken, ttl);
      storedId = true;
    }

    return json(res, 200, {
      ok: true,
      key: keyBase,
      stored: {
        refresh: true,
        access: storedAccess,
        id: storedId,
      },
    });
  } catch (err) {
    return json(res, 500, {
      ok: false,
      error: "bind_failed",
      details: err?.message || String(err),
    });
  }
}
