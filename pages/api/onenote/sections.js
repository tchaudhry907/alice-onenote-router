export default async function handler(req, res) {
  const r = await fetch(`${process.env.APP_BASE_URL}/api/onenote/proxy?url=https://graph.microsoft.com/v1.0/me/onenote/sections`);
  const text = await r.text();
  res.status(r.status).send(text);
}
