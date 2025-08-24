// pages/api/debug/pkce.js
import crypto from "crypto";
function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
export default async function handler(req, res) {
  const cookies = req.cookies || {};
  const code_verifier = cookies.pkce_verifier || null;
  const state_cookie = cookies.oauth_state || null;
  const flow = cookies.flow || null;
  let challenge = null;
  if (code_verifier) {
    const hash = crypto.createHash("sha256").update(code_verifier).digest();
    challenge = b64url(hash);
  }
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(200).send(JSON.stringify({
    note: "This shows what *we* will send to the token endpoint.",
    query: { code: req.query.code ?? null, state: req.query.state ?? null },
    cookies: { pkce_verifier: !!code_verifier, oauth_state: state_cookie, flow },
    derived: { code_challenge_from_cookie: challenge }
  }, null, 2));
}
