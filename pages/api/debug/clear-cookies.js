// pages/api/debug/clear-cookies.js
export default async function handler(_req, res) {
  const expired = "Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
  res.setHeader("Set-Cookie", [
    `pkce_verifier=; ${expired}`,
    `oauth_state=; ${expired}`,
    `flow=; ${expired}`,
    `session=; ${expired}`,
  ]);
  res.status(200).send("Cleared pkce_verifier, oauth_state, flow, session.");
}
