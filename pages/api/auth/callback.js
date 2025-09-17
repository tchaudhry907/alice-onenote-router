// pages/api/auth/callback.js
// Exchange auth code -> tokens; save to KV; send back to Diagnostics

import { kvSet } from "@/lib/kv";

async function postForm(url, data) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(data),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${text}`);
  return json;
}

export default async function handler(req, res) {
  try {
    const { code, error, error_description } = req.query;
    if (error) throw new Error(`${error}: ${error_description || ""}`);
    if (!code) throw new Error("Missing authorization code");

    const tenant = process.env.MS_TENANT_ID || process.env.AZURE_TENANT_ID || "common";
    const clientId = process.env.MS_CLIENT_ID || process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET || process.env.AZURE_CLIENT_SECRET;
    const redirect =
      process.env.MS_REDIRECT_URI ||
      `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}/api/auth/callback`;

    if (!clientId || !clientSecret) throw new Error("Missing MS_CLIENT_ID / MS_CLIENT_SECRET");

    const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
    const token = await postForm(tokenUrl, {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirect,
      scope: "openid offline_access profile https://graph.microsoft.com/.default",
    });

    const { access_token, refresh_token } = token;
    if (!access_token) throw new Error("No access_token in response");

    // Save tokens in KV for the server to use
    await kvSet("graph:access_token", access_token, { ex: 3500 });
    await kvSet("ms:access_token", access_token, { ex: 3500 });
    if (refresh_token) await kvSet("ms:refresh_token", refresh_token, { ex: 60 * 60 * 24 * 10 });

    // Back to diagnostics with a success flag
    const diag = `/debug/diagnostics?login=ok`;
    res.writeHead(302, { Location: diag });
    res.end();
  } catch (e) {
    const diag = `/debug/diagnostics?login=err&msg=${encodeURIComponent(e.message)}`;
    res.writeHead(302, { Location: diag });
    res.end();
  }
}
