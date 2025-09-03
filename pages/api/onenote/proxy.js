import { kv } from "@/lib/kv";
import { refreshAccessToken } from "@/lib/graph";
import { getTokenCookie } from "@/lib/cookie";

// Only allow Graph v1.0 and OneNote paths for safety.
const GRAPH_ORIGIN = "https://graph.microsoft.com";
const ALLOWED_PREFIX = `${GRAPH_ORIGIN}/v1.0/me/onenote`;

function buildTargetFromReq(req) {
  // 1) Support GET /api/onenote/proxy?url=<full Graph URL>
  if (req.method === "GET") {
    const url = req.query?.url;
    if (!url) throw new Error("Missing ?url");
    return { url, method: "GET", headers: {}, body: undefined };
  }

  // 2) Support POST with { path, method, headers, body } OR { url, ... }
  if (req.method === "POST") {
    const { url, path, method = "GET", headers = {}, body } = req.body || {};
    if (!url && !path) throw new Error("Missing 'url' or 'path' in body");

    const target = url
      ? url
      : `${GRAPH_ORIGIN}/v1.0${path.startsWith("/") ? path : `/${path}`}`;

    return {
      url: target,
      method: method || "GET",
      headers,
      body,
    };
  }

  throw new Error("Unsupported method; use GET with ?url=... or POST with { url|path }");
}

function assertAllowed(url) {
  try {
    const u = new URL(url);
    const full = `${u.origin}${u.pathname}`;
    if (!full.startsWith(ALLOWED_PREFIX)) {
      throw new Error("Blocked: URL must start with /v1.0/me/onenote");
    }
  } catch {
    throw new Error("Invalid URL");
  }
}

export default async function handler(req, res) {
  try {
    // Figure out where the caller wants to go
    const { url, method, headers, body } = buildTargetFromReq(req);
    assertAllowed(url);

    // Identify the session (cookie set during auth/callback)
    const tok = getTokenCookie(req);
    const redisKey = tok?.key;
    if (!redisKey) return res.status(401).json({ ok: false, error: "Not authenticated" });

    // Load refresh token
    const refreshToken = await kv.get(redisKey);
    if (!refreshToken) {
      return res.status(401).json({ ok: false, error: "Session expired. Please sign in again." });
    }

    // Get a fresh access token
    const fresh = await refreshAccessToken(refreshToken);
    const access = fresh.access_token;
    if (!access) throw new Error("No access_token from refresh");

    // Prepare outbound request
    const init = {
      method: method || "GET",
      headers: {
        Authorization: `Bearer ${access}`,
        ...(headers || {}),
      },
      body: undefined,
    };

    // If the caller provided a raw body (e.g., XHTML for create page), pass it through as-is.
    if (body !== undefined && body !== null) {
      // If it's an object and content-type is JSON, stringify it; otherwise assume it's a string/XML.
      const contentType = init.headers["Content-Type"] || init.headers["content-type"];
      if (typeof body === "object" && (!contentType || /json/i.test(contentType))) {
        init.headers["Content-Type"] = "application/json";
        init.body = JSON.stringify(body);
      } else {
        init.body = body;
      }
    }

    // Call Microsoft Graph
    const resp = await fetch(url, init);

    // Stream the result back (preserve status and content-type)
    const ct = resp.headers.get("content-type") || "application/json";
    const text = await resp.text();
    res.status(resp.status).setHeader("Content-Type", ct).send(text);
  } catch (e) {
    const msg = e?.message || String(e);
    // If we threw a usage error, make it 400; otherwise 500.
    const isUsage = /Missing|Unsupported|Invalid URL|Blocked/.test(msg);
    res.status(isUsage ? 400 : 500).json({ ok: false, error: msg });
  }
}
