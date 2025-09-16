// pages/api/auth/refresh.js
// Manual refresh endpoint. Useful for tests or when you want to “prime” the server.

import { refreshAccessToken } from "@/lib/auth";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  try {
    const fresh = await refreshAccessToken();

    // Optional: set a session cookie for convenience in your browser
    // (server does NOT rely on this; everything uses refresh when needed)
    res.setHeader(
      "Set-Cookie",
      `access_token=${encodeURIComponent(fresh.access_token)}; Path=/; Secure; SameSite=Lax; HttpOnly`
    );

    return res.status(200).json({ ok: true, access_token: "set (cookie)", expires_in: fresh.expires_in });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err.message || err) });
  }
}
