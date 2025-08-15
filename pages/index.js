// pages/index.js
export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial", padding: "2rem" }}>
      <h1 style={{ marginBottom: "0.5rem" }}>Alice OneNote Router</h1>
      <p style={{ marginTop: 0, color: "#555" }}>
        This is the starting point for your OneNote integration.
      </p>

      <section style={{ marginTop: "2rem" }}>
        <h2 style={{ fontSize: "1.1rem" }}>Quick actions</h2>
        <ul style={{ lineHeight: 1.8 }}>
          <li>
            <a href="/login">Sign in to OneNote (friendly route)</a>
          </li>
          <li>
            <a href="/api/auth/login">Start OAuth (direct API route)</a>
          </li>
          <li>
            <a href="/api/hello">API health check</a>
          </li>
        </ul>
      </section>

      <section style={{ marginTop: "2rem", color: "#666", fontSize: "0.95rem" }}>
        <p>
          Note: visiting <code>/api/auth/callback</code> directly will show an error. That
          endpoint is only used when Microsoft redirects back after sign‑in.
        </p>
      </section>
    </main>
  );
}
