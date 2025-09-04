// pages/api/auth/login.js
import crypto from "crypto";

function getBaseUrl(req) {
  // Prefer explicit env; otherwise infer from request
  const envBase = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL;
  if (envBase) return envBase.replace(/\/$/, "");
  const proto = (req.headers["x-forwarded-proto"] || "https").toString();
  const host = (req.headers.host || "").toString();
  return `${proto}://${host}`;
}

export default async function handler(req, res) {
  try {
    const clientId =
      process.env.msclientid || process.env.MS_CLIENT_ID || process.env.AZURE_AD_CLIENT_ID;
    if (!clientId) {
      return res
        .status(500)
        .json({ ok: false, error: "Missing msclientid / MS_CLIENT_ID environment variable" });
    }

    const tenant = process.env.MS_TENANT_ID || "common";
    const baseUrl = getBaseUrl(req);
    const redirectUri = `${baseUrl}/api/auth/callback`;

    // Scopes: include OneNote + offline_access for refresh tokens
    const scope =
      process.env.MS_SCOPES ||
      "offline_access openid profile User.Read Notes.ReadWrite.All";

    // Optional: PKCE (good practice, no extra deps)
    const verifier = crypto.randomBytes(32).toString("base64url");
    const challenge = crypto
      .createHash("sha256")
      .update(verifier)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    // store state + verifier in HttpOnly cookies for callback to validate
    const state = crypto.randomBytes(16).toString("hex");
    const cookieFlags = "Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=600";
    res.setHeader("Set-Cookie", [
      `oauth_state=${state}; ${cookieFlags}`,
      `pkce_verifier=${verifier}; ${cookieFlags}`,
    ]);

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      response_mode: "query",
      scope,
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
      prompt: "select_account",
    });

    const authUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;
    res.writeHead(302, { Location: authUrl });
    res.end();
  } catch (e) {
    console.error("login error", e);
    res.status(500).json({ ok: false, error: "Exception starting login" });
  }
}
