// lib/auth.js
//
// v2 helper set + shims for legacy imports so the build succeeds.

export function getBearerFromReq(req) {
  const hdr = req.headers?.authorization || "";
  if (hdr && /^Bearer\s+/i.test(hdr)) return hdr;

  const tok = req.cookies?.access_token;
  if (tok) return `Bearer ${tok}`;

  return "";
}

export async function graphFetch(url, opts = {}, bearer = "") {
  const headers = { ...(opts.headers || {}) };
  const auth = bearer || headers.Authorization || headers.authorization || "";
  if (!auth) throw new Error("No access token");

  const res = await fetch(url, {
    method: opts.method || "GET",
    headers: { Authorization: auth, ...headers },
    body: opts.body,
  });

  let json = null;
  try { json = await res.json(); } catch { /* ignore non-JSON */ }

  if (!res.ok) {
    const msg = json ? JSON.stringify(json) : `${res.status} ${res.statusText}`;
    throw new Error(`graph ${opts.method || "GET"} ${new URL(url).pathname} -> ${res.status}: ${msg}`);
  }
  return json ?? {};
}

export async function graphGET(url, bearer) {
  return graphFetch(url, { method: "GET" }, bearer);
}
export async function graphPOST(url, body, bearer, headers = {}) {
  return graphFetch(url, { method: "POST", headers, body }, bearer);
}
export async function graphDELETE(url, bearer) {
  return graphFetch(url, { method: "DELETE" }, bearer);
}

/* ---------------- Legacy shims so older routes still import successfully. --------------- */

// Old code asked for a raw token via getAccessToken(req)
export function getAccessToken(req) {
  const b = getBearerFromReq(req);
  return b.replace(/^Bearer\s+/i, "");
}

// Rare old callsite used this to enforce auth.
export function requireAuth(req) {
  const b = getBearerFromReq(req);
  if (!b) throw new Error("No access token");
  return b;
}

// Old refresh flow; we don’t need it in v2. Provide a no-op that returns the
// token we already have (so callers won’t crash).
export async function refreshAccessToken(req) {
  const token = getAccessToken(req);
  if (!token) throw new Error("No access token to refresh");
  return { access_token: token, refreshed: false };
}

// Some code imported readCookie(req, name); add a tiny helper.
export function readCookie(req, name) {
  const raw = req.headers?.cookie || "";
  const parts = raw.split(/;\s*/);
  for (const p of parts) {
    const [k, ...rest] = p.split("=");
    if (k === name) return decodeURIComponent(rest.join("=") || "");
  }
  return "";
}
