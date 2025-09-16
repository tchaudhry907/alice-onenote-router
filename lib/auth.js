// lib/auth.js
// Minimal Graph helpers that (1) accept Authorization header from the caller,
// and (2) fall back to an access_token cookie if header is missing.

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

// --- tiny cookie parser ---
function parseCookie(headerVal = "") {
  const out = {};
  headerVal.split(";").forEach((kv) => {
    const i = kv.indexOf("=");
    if (i > -1) out[kv.slice(0, i).trim()] = decodeURIComponent(kv.slice(i + 1).trim());
  });
  return out;
}

// Extract a bearer token from Authorization header OR access_token cookie.
export function getBearerFromReq(req) {
  // 1) Authorization header wins if provided
  const auth = req.headers?.authorization || req.headers?.Authorization;
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }
  // 2) Fallback: cookie named access_token
  const cookieHeader = req.headers?.cookie || "";
  const cookies = parseCookie(cookieHeader);
  if (cookies.access_token) return cookies.access_token;

  return null;
}

async function safeText(res) {
  try { return await res.text(); } catch { return ""; }
}

async function graphFetch(req, method, path, body, contentType) {
  const token = getBearerFromReq(req);
  if (!token) {
    const err = new Error("No access token (missing Authorization header and access_token cookie).");
    err.status = 401;
    throw err;
  }

  const headers = { Authorization: `Bearer ${token}` };
  if (contentType) headers["Content-Type"] = contentType;

  const url = path.startsWith("http") ? path : `${GRAPH_BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers,
    body: typeof body === "string" ? body : (body ? JSON.stringify(body) : undefined)
  });

  if (!res.ok) {
    const txt = await safeText(res);
    const err = new Error(`graph ${method} ${path} -> ${res.status}: ${txt}`);
    err.status = res.status;
    err.payload = txt;
    throw err;
  }
  // Some Graph endpoints return empty on 204
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("json")) return {};
  return res.json();
}

export async function graphGET(req, path) {
  return graphFetch(req, "GET", path);
}

export async function graphPOST(req, path, body, contentType = "application/json") {
  return graphFetch(req, "POST", path, body, contentType);
}

// Small util others may want
export async function graphMe(req) {
  return graphGET(req, "/me");
}
