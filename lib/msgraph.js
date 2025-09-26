// lib/msgraph.js

async function toJsonOrText(res) {
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

export async function graphFetch(accessToken, url, options = {}) {
  if (!accessToken) throw new Error("graphFetch: accessToken is required");
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const body = await toJsonOrText(res).catch(() => "");
    throw new Error(
      `graphFetch failed: ${res.status} ${res.statusText} @ ${url} :: ${JSON.stringify(body)}`
    );
  }
  return toJsonOrText(res);
}

export async function exchangeRefreshToken(refreshToken) {
  const tenant = process.env.MS_TENANT_ID || "common";
  const clientId = process.env.MS_CLIENT_ID;
  const clientSecret = process.env.MS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("exchangeRefreshToken: MS_CLIENT_ID / MS_CLIENT_SECRET not configured");
  }
  if (!refreshToken) throw new Error("exchangeRefreshToken: refreshToken required");

  const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: "https://graph.microsoft.com/.default offline_access openid profile"
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });

  if (!res.ok) {
    const body = await toJsonOrText(res).catch(() => "");
    throw new Error(
      `exchangeRefreshToken failed: ${res.status} ${res.statusText} :: ${JSON.stringify(body)}`
    );
  }
  return res.json();
}

export async function createOneNotePageBySectionId(accessToken, sectionId, htmlContent) {
  if (!accessToken) throw new Error("createOneNotePageBySectionId: accessToken required");
  if (!sectionId) throw new Error("createOneNotePageBySectionId: sectionId required");

  const url = `https://graph.microsoft.com/v1.0/me/onenote/sections/${encodeURIComponent(
    sectionId
  )}/pages`;

  const boundary = "msgraph_boundary_" + Math.random().toString(36).slice(2);
  const html =
    htmlContent ||
    "<!DOCTYPE html><html><head><title>Alice Logger</title></head><body><p>Hello from AliceOneNoteLogger v5</p></body></html>";

  const body =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="Presentation"\r\n` +
    `Content-Type: text/html\r\n\r\n` +
    html +
    `\r\n--${boundary}--`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`
    },
    body
  });

  if (!res.ok) {
    const msg = await toJsonOrText(res).catch(() => "");
    throw new Error(
      `createOneNotePageBySectionId failed: ${res.status} ${res.statusText} :: ${JSON.stringify(msg)}`
    );
  }
  return res.json();
}
