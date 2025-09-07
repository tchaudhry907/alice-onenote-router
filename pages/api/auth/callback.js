// pages/api/auth/callback.js
export default async function handler(req, res) {
  try {
    // ... existing token exchange and session save ...

    // Redirect to diagnostics page for debugging
    res.redirect("/debug/diagnostics");
  } catch (err) {
    console.error("Auth callback error:", err);
    res.status(500).send("Authentication failed");
  }
}
