export default function handler(req, res) {
  res.status(200).json({
    cookies: req.cookies,
    headers: req.headers,
  });
}
