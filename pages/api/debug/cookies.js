// pages/api/debug/cookies.js 
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(200).send(JSON.stringify({ cookies: req.cookies ?? {} }, null, 2));
}
