// lib/auth.js
export function getBearerFromReq(req) {
  const hdr = req.headers?.authorization || "";
  if (hdr && /^Bearer\s+/i.test(hdr)) return hdr;

  const cookieTok = req.cookies?.access_token;
  if (cookieTok) return `Bearer ${cookieTok}`;

  return "";
}

export async function graphFetch(url, opts = {}, bearer = "") {
  const headers = Object.assign({}, opts.headers || {});
  const auth = bearer || headers.Authorization || headers.authorization || "";
  if (!auth) throw new Error("No access token");

  const res = await fetch(url, {
    method: opts.method || "GET",
    headers: { Authorization: auth, ...headers },
    body: opts.body,
  });

  let json = null;
  try { json = await res.json(); } catch { /* non-JSON */ }

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
  return graphFetch(
    url,
    { method: "POST", headers, body },
    bearer
  );
}

export async function graphDELETE(url, bearer) {
  return graphFetch(url, { method: "DELETE" }, bearer);
}
