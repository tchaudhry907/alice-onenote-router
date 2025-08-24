// pages/api/auth/callback.js
import fetch from "node-fetch";

const TENANT = process.env.MS_TENANT_ID || process.env.MS_TENANT || "consumers";
const CLIENT_ID = process.env.MS_CLIENT_ID;
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET;   // we ARE using a confidential client
const REDIRECT_URI = process.env.REDIRECT_URI;

function readCookie(req, name) {
  const h = req.headers.cookie || "";
  const map = Object.fromEntries(h.split(";").map(c => c.trim().split("=").map(decodeURIComponent)).filter(p => p[0]));
  return map[name];
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).send("Method not allowed");

    const { code, state, error, error_description } = req.query;

    // if Azure sent back an error
    if (error) {
      return res.status(400).send(`Sign‑in error: ${error}: ${error_description || ""}`);
    }

    // state / verifier from cookies
    const expectedState = readCookie(req, "oauth_state");
    const verifier = readCookie(req, "pkce_verifier");
    if (!expectedState || state !== expectedState) {
      return res.status(400).send("Invalid or missing state. Start at /api/auth/login");
    }
    if (!code) {
      return res.status(400).send('Missing "code" on callback.');
    }
    if (!verifier) {
      return res.status(400).send('Missing PKCE verifier. Start at /api/auth/login');
    }

    if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
      return res.status(500).send("Server is missing CLIENT_ID/CLIENT_SECRET/REDIRECT_URI.");
    }

    // Exchange code for tokens (Authorization Code, confidential client + PKCE)
    const tokenUrl = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier
    });

    const tokenResp = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });

    const tokenJson = await tokenResp.json();

    if (!tokenResp.ok) {
      // bubble full message for debugging
      res.status(500).send(
        `Token exchange failed (${tokenResp.status}). ${tokenJson.error}: ${tokenJson.error_description || ""}`
      );
      return;
    }

    // Set HttpOnly cookies so we can call Graph
    const maxAge = Number(tokenJson.expires_in || 3600);
    const cookies = [
      `graph_access_token=${encodeURIComponent(tokenJson.access_token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`,
      tokenJson.refresh_token
        ? `graph_refresh_token=${encodeURIComponent(tokenJson.refresh_token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=1209600`
        : undefined,
      // clear the transient cookies
      `pkce_verifier=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
      `oauth_state=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
    ].filter(Boolean);

    res.setHeader("Set-Cookie", cookies);

    // where to send the user after sign‑in
    const nextUrl = readCookie(req, "post_login_redirect") || "/";
    return res.redirect(nextUrl.includes("http") ? nextUrl : `${nextUrl}?login=success`);
  } catch (err) {
    res.status(500).send(`Callback failure: ${err?.message || String(err)}`);
  }
}
