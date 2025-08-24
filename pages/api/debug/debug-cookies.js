
// pages/api/debug-cookies.js
export default function handler(req, res) {
  res.status(200).json({
    host: req.headers.host,
    app_base_url: process.env.APP_BASE_URL,
    cookies: req.headers.cookie || "(none)"
  });
}
