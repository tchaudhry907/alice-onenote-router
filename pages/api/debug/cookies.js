// pages/api/debug/cookies.js
import cookie from "cookie";

export default function handler(req, res) {
  // Raw Cookie header (exactly what the server received)
  const raw = req.headers.cookie || "";

  // Parsed cookies as key/value
  const parsed = cookie.parse(raw);

  // Helpful env bits to confirm callback/login base
  const env = {
    APP_BASE_URL: process.env.APP_BASE_URL || null,
    MS_TENANT: process.env.MS_TENANT || null,
    MS_CLIENT_ID: process.env.MS_CLIENT_ID ? "[set]" : "[missing]",
    MS_CLIENT_SECRET: process.env.MS_CLIENT_SECRET ? "[set]" : "[missing]",
  };

  res.setHeader("Content-Type", "application/json");
  res.status(200).send(
    JSON.stringify(
      {
        note: "Cookies visible to this API route (server-side).",
        now: new Date().toISOString(),
        method: req.method,
        url: req.url,
        rawCookieHeader: raw,
        parsedCookies: parsed,
        envSummary: env,
        tip: "Before sign-in you should NOT see 'pkce_verifier'. After hitting /api/auth/login and being redirected back from Microsoft, you SHOULD see it (until callback clears it).",
      },
      null,
      2
    )
  );
}
