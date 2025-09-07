// pages/api/auth/refresh.js
/**
 * Refresh the Microsoft Graph tokens and store them in:
 *   - Cookies (httpOnly)
 *   - KV under key "msauth:default"  →  { access, refresh, id }
 *
 * Requirements:
 *   MS_CLIENT_ID, MS_CLIENT_SECRET, MS_TENANT, MS_SCOPES (space-separated)
 */

import { get as kvGet, set as kvSet } from "@/lib/kv";

function json(res, code, body) {
  res.status(code).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function setCookie(res, name, value, { maxAgeSec }) {
  // secure, lax, httpOnly
  const parts = [
    `${name}=${encodeURIComponent(value || "")}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${maxAgeSec}`,
  ];
  res.appendHeader
    ? res.appendHeader("Set-Cookie", parts.join("; "))
    : res.setHeader("Set-Cookie", parts.join("; "));
}

async function readRefreshTokenFromAnywhere(req) {
  // 1) cookie set by this app (preferred)
  const cookie = req.cookies?.refresh_token || req.cookies?.ms_refresh_token;
  if (cookie) return cookie;

  // 2) from KV if already saved
  const raw = await kvGet("msauth:default");
  if (raw) {
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (parsed?.refresh) return parsed.refresh;
    } catch {}
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  const client_id = process.env.MS_CLIENT_ID;
  const client_secret = process.env.MS_CLIENT_SECRET;
  const tenant = process.env.MS_TENANT || "common";
  const scopes =
    (process.env.MS_SCOPES &&
      process.env.MS_SCOPES.split(/[ ,]+/).filter(Boolean).join(" ")) ||
    "offline_access openid profile User.Read Notes.ReadWrite Notes.ReadWrite.All Notes.Create Files.ReadWrite.All";

  if (!client_id || !client_secret) {
    return json(res, 500, { ok: false, error: "Missing client credentials env" });
  }

  // Get a refresh token from cookie or KV
  const refresh_token = await readRefreshTokenFromAnywhere(req);
  if (!refresh_token) {
    return json(res, 400, { ok: false, error: "No refresh_token cookie or KV value" });
  }

  // Exchange refresh token
  const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(
    tenant
  )}/oauth2/v2.0/token`;

  const form = new URLSearchParams();
  form.set("client_id", client_id);
  form.set("client_secret", client_secret);
  form.set("grant_type", "refresh_token");
  form.set("refresh_token", refresh_token);
  form.set("scope", scopes);

  let tokenRes, tokenJson;
  try {
    tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    tokenJson = await tokenRes.json();
  } catch (e) {
    return json(res, 502, { ok: false, error: "Token endpoint failed", detail: String(e) });
  }

  if (!tokenRes.ok) {
    return json(res, tokenRes.status, {
      ok: false,
      error: "Token refresh error",
      detail: tokenJson,
    });
  }

  const access = tokenJson.access_token || "";
  const id = tokenJson.id_token || "";
  const newRefresh = tokenJson.refresh_token || refresh_token; // MS may roll it

  // Persist to KV (source of truth for server calls)
  await kvSet(
    "msauth:default",
    JSON.stringify({ access, refresh: newRefresh, id }),
  );

  // Also set cookies (useful for debug tooling)
  if (access) setCookie(res, "access_token", access, { maxAgeSec: 60 * 60 });
  if (id) setCookie(res, "id_token", id, { maxAgeSec: 60 * 60 });
  if (newRefresh)
    setCookie(res, "refresh_token", newRefresh, { maxAgeSec: 60 * 60 * 24 * 90 });

  return json(res, 200, {
    ok: true,
    token_type: tokenJson.token_type || "Bearer",
    scope: tokenJson.scope,
    expires_in: tokenJson.expires_in,
    message: "Tokens refreshed and cookies + KV updated",
  });
}
