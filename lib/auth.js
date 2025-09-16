// lib/auth.js
// Header-first Microsoft Graph auth utilities with back-compat shims.
// - Preferred: Authorization: Bearer <token>
// - Optional:  x-access-token: <token>
// - Legacy:    cookie: access_token=<token>

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const p of header.split(/;\s*/)) {
    const [k, ...v] = p.split("=");
    if (!k) continue;
    out[k.trim()] = decodeURIComponent((v.join("=") || "").trim());
  }
  return out;
}

export function getBearerFromReq(req) {
  const h = req.headers || {};
  const auth = h.authorization || h.Authorization;
  if (auth && /^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, "").trim();

  const x = h["x-access-token"];
  if (typeof x === "string" && x.trim()) return x.trim();

  const cookies = parseCookies(h.cookie || "");
  if (cookies.access_token) return cookies.access_token;

  return null;
}

// ✅ Back-compat: many routes expect getAccessToken(req)
export function getAccessToken(req) {
  return getBearerFromReq(req);
}

// ✅ Back-compat: some routes call requireAuth(req, res)
export function requireAuth(req, res) {
  const token = getBearerFromReq(req);
  if (!token) {
    if (res) {
      res
        .status(401)
        .json({ ok: false, error: "Missing access token (send Authorization: Bearer …)" });
    }
    return null;
  }
  return token;
}

async function safeText(res) {
  try { return await res.text(); } catch { return ""; }
}

export async function graphGET(token, path) {
  if (!token) {
    const err = new Error("Missing access token");
    err.status = 401; throw err;
  }
  const url = path.startsWith("http")
    ? path
    : `https://graph.microsoft.com/v1.0${path}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) {
    const t = await safeText(r);
    const err = new Error(`graphGET ${path} -> ${r.status}: ${t}`);
    err.status = r.status; err.payload = t; throw err;
  }
  return r.json();
}

export async function graphPOST(token, path, body, contentType = "application/json") {
  if (!token) {
    const err = new Error("Missing access token");
    err.status = 401; throw err;
  }
  const url = path.startsWith("http")
    ? path
    : `https://graph.microsoft.com/v1.0${path}`;
  const headers = { Authorization: `Bearer ${token}` };
  if (contentType) headers["Content-Type"] = contentType;

  const r = await fetch(url, {
    method: "POST",
    headers,
    body: contentType === "application/json" ? JSON.stringify(body) : body,
  });

  if (!r.ok) {
    const t = await safeText(r);
    const err = new Error(`graphPOST ${path} -> ${r.status}: ${t}`);
    err.status = r.status; err.payload = t; throw err;
  }
  return r.json();
}
