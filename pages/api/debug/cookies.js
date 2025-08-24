// pages/api/debug-cookies.js
export default function handler(req, res) {
  res.status(200).json({
    cookies: req.cookies ?? {},
    headers: {
      cookie: req.headers?.cookie ?? null,
      host: req.headers?.host ?? null,
      "user-agent": req.headers?.["user-agent"] ?? null,
      referer: req.headers?.referer ?? null
    }
  });
}
