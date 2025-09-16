// lib/auth.js
// Single place to: (a) read Bearer tokens from requests,
// (b) call Microsoft Graph with that token.

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  const parts = header.split(/;\s*/);
  for (const p of parts) {
    const [k, ...v] = p.split("=");
    if (!k) continue;
    out[k.trim()] = decodeURIComponent((v.join("=") || "").trim());
  }
  return out;
}

export function getBearerFromReq(req) {
  // 1) Preferred: Authorization: Bearer <token>
  const auth = req.headers?.authorization || req.headers?.Authorization;
  if (auth && /^Bearer\s+/i.test(auth)) {
    return auth.replace(/^Bearer\s+/i, "").trim();
  }

  // 2) Optional convenience header (not required): x-access-token
  const x = req.headers?.["x-access-token"];
  if (typeof x === "string" && x.trim()) {
    return x.trim();
  }

  // 3) Legacy fallback: cookie named access_token (kept for compatibility)
  const cookies = parseCookies(req.headers?.cookie || "");
  if (cookies.access_token) return cookies.access_token;

  return null;
}

async function safeText(res) {
  try { return await res.text(); } catch { return ""; }
}

export async function graphGET(token, path) {
  if (!token) {
    const err = new Error("Missing access token");
    err.status = 401;
    throw err;
  }
  const url = path.startsWith("http")
    ? path
    : `https://graph.microsoft.com/v1.0${path}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) {
    const t = await safeText(r);
    const err = new Error(`graphGET ${path} -> ${r.status}: ${t}`);
    err.status = r.status;
    err.payload = t;
    throw err;
  }
  return r.json();
}

export async function graphPOST(token, path, body, contentType = "application/json") {
  if (!token) {
    const err = new Error("Missing access token");
    err.status = 401;
    throw err;
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
    err.status = r.status;
    err.payload = t;
    throw err;
  }
  return r.json();
}
