// pages/index.js
export default function Home() {
  return (
    <main style={{fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial", padding: 24, lineHeight: 1.5}}>
      <h1>Alice OneNote Router</h1>
      <p>This is the starting point for your OneNote integration.</p>
      <h3>Quick actions</h3>
      <ul>
        <li><a href="/login">Sign in to OneNote (friendly route)</a></li>
        <li><a href="/api/auth/login">Start OAuth (direct API route)</a></li>
        <li><a href="/api/hello">API health check</a></li>
      </ul>
      <p style={{marginTop: 24, fontSize: 14, color: "#666"}}>
        Note: visiting <code>/api/auth/callback</code> directly will show an error. That endpoint is only used when Microsoft redirects back after sign‑in.
      </p>
    </main>
  );
}
