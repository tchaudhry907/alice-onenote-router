// pages/api/auth/callback.js
// Lightweight callback handler: exchanges the code for tokens,
// clears the PKCE cookie, drops a tiny "session" cookie, then
// redirects to "/" with a success or error flag.
// NOTE: This does not persist tokens yet.

function setCookie(res, name, value, options = {}) {
  const {
    httpOnly = true,
    secure = true,
    sameSite = "lax",
    path = "/",
    maxAge, // seconds
  } = options;

  const parts = [`${name}=${value ?? ""}`];
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  if (path) parts.push(`Path=${path}`);
  if (sameSite) parts.push(`SameSite=${sameSite}`);
  if (secure) parts.push(`Secure`);
  if (httpOnly) parts.push(`HttpOnly`);

  // support multiple Set-Cookie headers
  const prev = res.getHeader("Set-Cookie");
  if (prev) {
    res.setHeader("Set-Cookie", Array.isArray(prev) ? [...prev, parts.join("; ")] : [prev, parts.join("; ")]);
  } else {
    res.setHeader("Set-Cookie", parts.join("; "));
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end("Method Not Allowed");
  }

  const { code, state, error, error_description } = req.query;

  // If Microsoft sent an OAuth error back, surface it and bounce home
  if (error) {
    // clear pkce cookie if present
    setCookie(res, "pkce_verifier", "", { maxAge: 0, httpOnly: true, path: "/" });
    return res.redirect(`/?login=error&reason=${encodeURIComponent(error_description || error)}`);
  }

  // We require a code and the PKCE verifier cookie set by /api/auth/login
  const verifier = req.cookies?.pkce_verifier;
  if (!code || !verifier) {
    // Missing verifier is the “PKCE verifier” message you were seeing earlier
    return res.redirect("/api/auth/login?err=missing_verifier");
  }

  // Exchange the auth code for tokens at Azure
  const body = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID,
    scope: "openid profile offline_access Notes.ReadWrite.All",
    code,
    redirect_uri: process.env.REDIRECT_URI, // e.g. https://<your-app>/api/auth/callback
    grant_type: "authorization_code",
    code_verifier: verifier,
  });

  // If you’re using a client secret (your screenshots show one), include it:
  if (process.env.MS_CLIENT_SECRET && process.env.MS_CLIENT_SECRET !== "not-set") {
    body.set("client_secret", process.env.MS_CLIENT_SECRET);
  }

  const tokenResp = await fetch(
    `https://login.microsoftonline.com/${process.env.MS_TENANT}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    }
  );

  let tokenData;
  try {
    tokenData = await tokenResp.json();
  } catch (e) {
    // If Azure didn’t return JSON, treat as error
    return res.redirect("/?login=error&reason=invalid_token_response");
  }

  if (!tokenResp.ok || tokenData?.error) {
    // Common cause: wrong tenant, wrong redirect URI, or missing client_secret
    const msg = tokenData?.error_description || tokenData?.error || "token_exchange_failed";
    // clear PKCE cookie to avoid stale verifier
    setCookie(res, "pkce_verifier", "", { maxAge: 0, httpOnly: true, path: "/" });
    return res.redirect(`/?login=error&reason=${encodeURIComponent(msg)}`);
  }

  // ---- Lightweight "you're logged in" cookie (no real token storage yet) ----
  // DO NOT use this in production—just for your current flow confirmation.
  setCookie(res, "session", "ok", { maxAge: 3600, httpOnly: true, path: "/" }); // 1 hour
  // Clean up the PKCE cookie so it’s not reused
  setCookie(res, "pkce_verifier", "", { maxAge: 0, httpOnly: true, path: "/" });

  // Redirect back home (or wherever you want)
  return res.redirect("/?login=success");
}
