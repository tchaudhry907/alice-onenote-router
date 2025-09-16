// lib/auth.js – compatibility shim used by many API routes
const GRAPH = "https://graph.microsoft.com/v1.0";

/* ---------- token helpers ---------- */
function parseCookie(headerVal = "") {
  const out = {};
  headerVal.split(";").forEach((kv) => {
    const i = kv.indexOf("=");
    if (i > -1) out[kv.slice(0, i).trim()] = decodeURIComponent(kv.slice(i + 1).trim());
  });
  return out;
}

export function getBearerFromReq(req) {
  const auth = req.headers?.authorization || req.headers?.Authorization;
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    const tok = auth.slice(7).trim();
    if (tok) return tok;
  }
  const cookieHeader = req.headers?.cookie || "";
  const cookies = parseCookie(cookieHeader);
  if (cookies.access_token) return cookies.access_token;
  return null;
}

export async function getAccessToken(req) {
  // legacy name used by some routes
  return getBearerFromReq(req);
}

export function requireAuth(handler) {
  // middleware-style wrapper some routes expect
  return async (req, res) => {
    const token = getBearerFromReq(req);
    if (!token) {
      return res.status(401).json({ ok: false, error: "No access token" });
    }
    return handler(req, res);
  };
}

/* ---------- Graph fetchers ---------- */
async function safeText(r) { try { return await r.text(); } catch { return ""; } }

export async function graphFetch(req, method, path, body, contentType) {
  const token = getBearerFromReq(req);
  if (!token) {
    const err = new Error("No access token");
    err.status = 401;
    throw err;
  }
  const headers = { Authorization: `Bearer ${token}` };
  if (contentType) headers["Content-Type"] = contentType;

  const url = path.startsWith("http") ? path : `${GRAPH}${path}`;
  const res = await fetch(url, {
    method,
    headers,
    body: typeof body === "string" ? body : (body ? JSON.stringify(body) : undefined),
  });

  if (!res.ok) {
    const txt = await safeText(res);
    const err = new Error(`graph ${method} ${path} -> ${res.status}: ${txt}`);
    err.status = res.status;
    err.payload = txt;
    throw err;
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("json") ? res.json() : {};
}

export async function graphGET(req, path) {
  return graphFetch(req, "GET", path);
}

export async function graphPOST(req, path, body, contentType = "application/json") {
  const payload = contentType === "application/json" ? body : body; // already encoded if multipart
  return graphFetch(req, "POST", path, payload, contentType);
}

/* ---------- refreshAccessToken (stub) ---------- */
// Some legacy routes import this. We don’t refresh on the server; clients should present
// a fresh access_token. This stub keeps build green and returns a clear error if invoked.
export async function refreshAccessToken(/* req */) {
  return { ok: false, error: "Server-side refresh not implemented. Provide a fresh access_token in Authorization header." };
}
