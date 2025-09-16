// lib/auth.js — lean, cookie-less auth + Graph helpers for all API routes
const GRAPH = "https://graph.microsoft.com/v1.0";

// --- tiny cookie parser (kept for legacy callers; we don't rely on it) ---
function parseCookie(headerVal = "") {
  const out = {};
  headerVal.split(";").forEach((kv) => {
    const i = kv.indexOf("=");
    if (i > -1) out[kv.slice(0, i).trim()] = decodeURIComponent(kv.slice(i + 1).trim());
  });
  return out;
}

// --- pull bearer from header first, then from a legacy access_token cookie ---
export function getBearerFromReq(req) {
  const hdr = req.headers?.authorization || req.headers?.Authorization;
  if (hdr && typeof hdr === "string" && hdr.toLowerCase().startsWith("bearer ")) {
    const tok = hdr.slice(7).trim();
    if (tok) return tok;
  }
  const cookieHeader = req.headers?.cookie || "";
  const cookies = parseCookie(cookieHeader);
  return cookies.access_token || null;
}

// legacy names some files import:
export async function getAccessToken(req) {
  return getBearerFromReq(req);
}
export function requireAuth(handler) {
  return async (req, res) => {
    const tok = getBearerFromReq(req);
    if (!tok) return res.status(401).json({ ok: false, error: "No access token" });
    return handler(req, res);
  };
}

// --- core Graph fetcher (tolerant to non-string path) ---
async function safeText(r) { try { return await r.text(); } catch { return ""; } }

export async function graphFetch(req, method, path, body, contentType) {
  const token = getBearerFromReq(req);
  if (!token) {
    const err = new Error("No access token");
    err.status = 401;
    throw err;
  }
  const p = String(path || "");
  const url = p.startsWith("http") ? p : `${GRAPH}${p}`;
  const headers = { Authorization: `Bearer ${token}` };
  if (contentType) headers["Content-Type"] = contentType;

  const init = { method, headers };
  if (body !== undefined) {
    // if contentType is JSON, body can be object; otherwise it must be a string/buffer
    init.body = contentType === "application/json" && typeof body !== "string"
      ? JSON.stringify(body)
      : body;
  }

  const res = await fetch(url, init);
  if (!res.ok) {
    const txt = await safeText(res);
    const err = new Error(`graph ${method} ${p} -> ${res.status}: ${txt}`);
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
  return graphFetch(req, "POST", path, body, contentType);
}

// Some old code imports this; we don’t refresh on the server.
export async function refreshAccessToken() {
  return { ok: false, error: "Server refresh not implemented. Send a fresh Authorization: Bearer token." };
}
