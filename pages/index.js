// pages/index.js
export default function Home() {
  return (
    <main style={{fontFamily:"system-ui, -apple-system, Segoe UI, Roboto, Arial", maxWidth: 720, margin:"2rem auto", lineHeight:1.6}}>
      <h1>Alice OneNote Router</h1>
      <p>This is the starting point for your OneNote integration.</p>

      <div style={{padding:"0.75rem 1rem", border:"1px solid #cce5cc", background:"#e6ffea", borderRadius:8, margin:"1rem 0"}}>
        <strong>Quick actions</strong>
        <ul>
          <li><a href="/login">Sign in (friendly route)</a></li>
          <li><a href="/api/auth/login">Start OAuth (direct API route)</a></li>
          <li><a href="/api/hello">API health check</a></li>
          <li><a href="/api/me">Show Graph /me (JSON)</a></li>
        </ul>
      </div>

      <p style={{color:"#666"}}>
        Note: visiting <code>/api/auth/callback</code> directly will show an error. That endpoint is only used
        when Microsoft redirects back after sign‑in.
      </p>
    </main>
  );
}
