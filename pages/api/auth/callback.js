// pages/api/auth/callback.js
const TOKEN_ENDPOINT = (tenant) =>
  `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;

const APP_BASE_URL = process.env.APP_BASE_URL;   // https://alice-onenote-router.vercel.app
const MS_TENANT = process.env.MS_TENANT;         // consumers
const MS_CLIENT_ID = process.env.MS_CLIENT_ID;
const MS_CLIENT_SECRET = process.env.MS_CLIENT_SECRET || "";
const REDIRECT_URI = process.env.REDIRECT_URI;

const PKCE_COOKIE = "pkce_verifier";

export default async function handler(req, res) {
  // Ensure callback is also on the canonical host (very defensive)
  const currentHost = req.headers["host"];
  const baseHost = new URL(APP_BASE_URL).host;
  if (currentHost && baseHost && currentHost !== baseHost) {
    const url = new URL(req.url ?? "", `https://${baseHost}`);
    return res.writeHead(307, { Location: url.toString() }).end();
  }

  const url = new URL(req.url, `https://${req.headers.host}`);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  // Pull PKCE verifier from cookie (must have been set by /api/auth/login)
  const cookieHeader = req.headers.cookie || "";
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k, decodeURIComponent(v.join("=") || "")];
    })
  );
  const verifier = cookies[PKCE_COOKIE];

  if (!code) {
    return res
      .status(400)
      .send('Missing "code" from Microsoft. Start at /api/auth/login');
  }
  if (!verifier) {
    return res
      .status(400)
      .send('Missing PKCE verifier. Start at /api/auth/login');
  }

  // Build token form
  const form = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier, // PKCE
  });

  // If you’ve created a client secret, send it (public client works without it)
  if (MS_CLIENT_SECRET) {
    form.set("client_secret", MS_CLIENT_SECRET);
  }

  // Exchange code for tokens
  const r = await fetch(TOKEN_ENDPOINT(MS_TENANT), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  const bodyText = await r.text();
  const contentType = r.headers.get("content-type") || "";
  const asJson =
    contentType.includes("application/json")
      ? JSON.parse(bodyText)
      : { raw: bodyText };

  if (!r.ok) {
    // Helpful diagnostics surfaced in the page
    return res
      .status(400)
      .send(
        `Token error:\nstatus=${r.status}\njson=${JSON.stringify(asJson)}`
      );
  }

  // Success: clear PKCE cookie and drop you back on home
  res.setHeader("Set-Cookie", [
    `${PKCE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
  ]);

  // For now, just show a success banner on /
  const successUrl = new URL("/", APP_BASE_URL);
  successUrl.searchParams.set("login", "success");
  return res.writeHead(302, { Location: successUrl.toString() }).end();
}
