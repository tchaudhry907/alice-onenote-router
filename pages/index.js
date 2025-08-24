export default function Home() {
  return (
    <main style={{fontFamily:'system-ui', maxWidth:720, margin:'40px auto', lineHeight:1.5}}>
      <h1>Alice OneNote Router</h1>
      <p>This is the starting point for your OneNote integration.</p>

      <div style={{padding:'14px 16px', background:'#e8f5e9', border:'1px solid #c5e1a5', borderRadius:8}}>
        <strong>Quick actions</strong>
        <ul>
          <li><a href="/login">Sign in (friendly route)</a></li>
          <li><a href="/api/auth/login">Start OAuth (direct API route)</a></li>
          <li><a href="/api/health">API health check</a></li>
          <li><a href="/api/debug-cookies">Show Graph (env, JSON)</a></li>
        </ul>
        <small>Note: visiting <code>/api/auth/callback</code> directly will show an error. That endpoint is only used when Microsoft redirects back after sign‑in.</small>
      </div>
    </main>
  );
}
