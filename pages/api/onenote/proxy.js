import { kv } from "@/lib/kv";
import { refreshAccessToken } from "@/lib/graph";
import { getTokenCookie } from "@/lib/cookie";

const GRAPH_ORIGIN = "https://graph.microsoft.com";
const ALLOWED_PREFIX = `${GRAPH_ORIGIN}/v1.0/me/onenote`;

function buildTargetFromReq(req) {
  if (req.method === "GET") {
    const url = req.query?.url;
    if (!url) throw new Error("Missing ?url");
    return { url, method: "GET", headers: {}, body: undefined };
  }

  if (req.method === "POST") {
    const { url, path, method = "GET", headers = {}, body } = req.body || {};
    if (!url && !path) throw new Error("Missing 'url' or 'path' in body");

    let target = url
      ? url
      : `${GRAPH_ORIGIN}/v1.0${path.startsWith("/") ? path : `/${path}`}`;

    // Replace placeholder with actual section id from env
    if (target.includes("SECTION_ID")) {
      const def = process.env.DEFAULT_SECTION_ID;
      if (!def) throw new Error("DEFAULT_SECTION_ID not set in env");
      target = target.replace("SECTION_ID", def);
    }

    return { url: target, method, headers, body };
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
    const { url, method, headers, body } = buildTargetFromReq(req);
    assertAllowed(url);

    const tok = getTokenCookie(req);
    const redisKey = tok?.key;
    if (!redisKey) return res.status(401).json({ ok: false, error: "Not authenticated" });

    const refreshToken = await kv.get(redisKey);
    if (!refreshToken) {
      return res.status(401).json({ ok: false, error: "Session expired. Please sign in again." });
    }

    const fresh = await refreshAccessToken(refreshToken);
    const access = fresh.access_token;
    if (!access) throw new Error("No access_token from refresh");

    const init = {
      method,
      headers: {
        Authorization: `Bearer ${access}`,
        ...(headers || {}),
      },
    };

    if (body !== undefined && body !== null) {
      const contentType = init.headers["Content-Type"] || init.headers["content-type"];
      if (typeof body === "object" && (!contentType || /json/i.test(contentType))) {
        init.headers["Content-Type"] = "application/json";
        init.body = JSON.stringify(body);
      } else {
        init.body = body;
      }
    }

    const resp = await fetch(url, init);
    const ct = resp.headers.get("content-type") || "application/json";
    const text = await resp.text();
    res.status(resp.status).setHeader("Content-Type", ct).send(text);
  } catch (e) {
    const msg = e?.message || String(e);
    const isUsage = /Missing|Unsupported|Invalid URL|Blocked|DEFAULT_SECTION_ID/.test(msg);
    res.status(isUsage ? 400 : 500).json({ ok: false, error: msg });
  }
}
