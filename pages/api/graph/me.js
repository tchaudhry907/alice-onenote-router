export default async function handler(req, res) {
  const cookies = Object.fromEntries(
    (req.headers.cookie || "").split(";").map(c => {
      const [k, ...rest] = c.trim().split("=");
      return [k, rest.join("=")];
    }).filter(([k]) => k)
  );

  const token = cookies.access_token;
  if (!token) {
    return res.status(401).json({ error: "No access_token cookie. Sign in first." });
  }

  const r = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${decodeURIComponent(token)}` }
  });

  const json = await r.json();
  res.status(r.ok ? 200 : r.status).json(json);
}
