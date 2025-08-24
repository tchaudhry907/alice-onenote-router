// pages/api/debug/headers.js
export default async function handler(req, res) {
  const { cookie, authorization, ...rest } = req.headers || {};
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(200).send(JSON.stringify({ headers: rest }, null, 2));
}
