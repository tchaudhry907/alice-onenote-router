// pages/api/session.js
import { requireAuth } from "@/lib/auth";
import { graphFetch } from "@/lib/msgraph";

export default async function handler(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return;
  try {
    const meRes = await graphFetch(auth.accessToken, "https://graph.microsoft.com/v1.0/me");
    const me = await meRes.json();
    if (!meRes.ok) return res.status(meRes.status).json({ ok: false, error: me });
    res.status(200).json({ ok: true, user: { displayName: me.displayName, email: me.userPrincipalName } });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
