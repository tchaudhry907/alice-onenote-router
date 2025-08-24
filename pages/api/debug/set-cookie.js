// pages/api/debug/set-cookie.js
export default function handler(req, res) {
  const { name = "test_cookie", value = "hello", seconds = 300 } = req.query;

  // Write an HttpOnly cookie scoped to the whole site so all routes can read it
  res.setHeader(
    "Set-Cookie",
    `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${Number(
      seconds
    )}; HttpOnly; Secure; SameSite=Lax`
  );

  res.status(200).json({
    set: { name, value, seconds: Number(seconds) },
    tip: "Now hit /api/debug/cookies to confirm the cookie is visible to the server.",
  });
}
