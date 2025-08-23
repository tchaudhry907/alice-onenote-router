// pages/index.js
export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial' }}>
      <h1>Alice OneNote Router</h1>
      <p>This is the starting point for your OneNote integration.</p>
      <h3>Quick actions</h3>
      <ul>
        <li><a href="/login">Sign in to OneNote (friendly route)</a></li>
        <li><a href="/api/auth/login">Start OAuth (direct API route)</a></li>
        <li><a href="/api/me">Test: call Microsoft Graph /me</a></li>
        <li><a href="/api/hello">API health check</a></li>
      </ul>
      <p><small>Note: visiting <code>/api/auth/callback</code> directly will show an error. That endpoint is only used when Microsoft redirects back after sign‑in.</small></p>
    </main>
  );
}
