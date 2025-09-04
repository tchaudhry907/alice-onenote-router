import { getToken } from "next-auth/jwt";
import { setCookie } from "cookies-next";
import { getAccessTokenFromRefresh } from "@/lib/msal";

export default async function handler(req, res) {
  try {
    // 1. Do normal Microsoft login (this already sets refresh_token cookie via callback)

    // 2. Try to immediately exchange refresh_token for a fresh access_token
    const refreshToken = req.cookies["refresh_token"];
    if (refreshToken) {
      const tokenResponse = await getAccessTokenFromRefresh(refreshToken);

      if (tokenResponse?.access_token) {
        // Store access token in a cookie for immediate use
        setCookie("access_token", tokenResponse.access_token, {
          req,
          res,
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          maxAge: tokenResponse.expires_in,
        });
      }
    }

    // 3. Redirect back to dashboard
    return res.redirect("/test");
  } catch (err) {
    console.error("Login handler failed", err);
    return res.status(500).json({ ok: false, error: "Login failed" });
  }
}
