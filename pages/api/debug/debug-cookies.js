export default function handler(req, res) {
  const cookies = req.headers.cookie || '';
  res.setHeader('Content-Type','application/json');
  res.status(200).send(JSON.stringify({ cookies }, null, 2));
}
