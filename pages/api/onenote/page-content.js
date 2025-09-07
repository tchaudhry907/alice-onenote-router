import { requireAuth, getAccessToken } from "@/lib/auth";

export default requireAuth(async function handler(req, res, session) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  const id = req.query.id;
  if (!id) return res.status(400).json({ ok: false, error: "Missing id" });

  const accessToken = await getAccessToken(session);
  const url = `https://graph.microsoft.com/v1.0/me/onenote/pages/${encodeURIComponent(
    id
  )}/content`;

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const body = await r.text();
  if (!r.ok) {
    return res
      .status(r.status)
      .json({ ok: false, error: "Fetch failed", status: r.status, body });
  }

  // Return as text/html directly
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(200).send(body);
});
