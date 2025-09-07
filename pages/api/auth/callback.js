import cookie from "cookie";

export default async function handler(req, res) {
  try {
    // Parse tokens returned by Microsoft OAuth
    const { access_token, refresh_token, id_token, expires_in } = req.query;

    if (!access_token || !refresh_token) {
      return res.status(400).json({ error: "Missing tokens in callback" });
    }

    // Save tokens in cookies
    res.setHeader("Set-Cookie", [
      cookie.serialize("access_token", access_token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: expires_in || 3600,
      }),
      cookie.serialize("refresh_token", refresh_token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      }),
      cookie.serialize("id_token", id_token || "", {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24,
      }),
    ]);

    // Redirect back to diagnostics so you can see results
    res.writeHead(302, { Location: "/debug/diagnostics" });
    res.end();
  } catch (err) {
    console.error("Callback error:", err);
    res.status(500).json({ error: "Callback failed", details: err.message });
  }
}
