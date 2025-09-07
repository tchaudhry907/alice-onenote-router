import { getAccessToken, requireAuth } from "@/lib/auth";

export default requireAuth(async function handler(req, res, session) {
  try {
    const token = await getAccessToken(session);

    const r = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await r.json();
    res.status(200).json({ ok: true, graph: data });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});
