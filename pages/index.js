// pages/index.js
export default function Home() {
  const success =
    typeof window !== "undefined" &&
    new URL(window.location.href).searchParams.get("login") === "success";

  return (
    <main style={{ padding: 24 }}>
      <h1>Alice OneNote Router</h1>
      <p>This is the starting point for your OneNote integration.</p>

      <div
        style={{
          background: success ? "#e0f7e9" : "#e9f1ff",
          padding: "12px 16px",
          borderRadius: 8,
          maxWidth: 640,
        }}
      >
        <strong>
          {success
            ? "Signed in! Session cookie set."
            : "No session cookie yet. Click a sign‑in link below."}
        </strong>

        <h3 style={{ marginTop: 12 }}>Quick actions</h3>
        <ul>
          <li><a href="/login">Sign in (friendly route)</a></li>
          <li><a href="/api/auth/login">Start OAuth (direct API route)</a></li>
          <li><a href="/api/me">API health check (/me JSON)</a></li>
          <li><a href="/api/onenote">Show Graph (me/onenote/notebooks JSON)</a></li>
        </ul>

        <p style={{ marginTop: 16, fontSize: 13, color: "#555" }}>
          Note: visiting <code>/api/auth/callback</code> directly will show an error.
          That endpoint is only used when Microsoft redirects back after sign‑in.
        </p>
      </div>
    </main>
  );
}
