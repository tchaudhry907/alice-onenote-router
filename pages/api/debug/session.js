// pages/api/debug/session.js
export default function handler(req, res) {
  const cookieHeader = req.headers.cookie || "";
  const hasSession = /(?:^|;\s*)session=ok(?:;|$)/.test(cookieHeader);
  res.status(200).json({
    hasSession,
    cookies: cookieHeader || "(none)",
  });
}
