// pages/login.js
export default function Login() {
  return (
    <main style={{ fontFamily: 'system-ui', maxWidth: 720, margin: '40px auto', lineHeight: 1.4 }}>
      <h1>Alice OneNote Router</h1>
      <p>This is the starting point for your OneNote integration.</p>

      <h3>Quick actions</h3>
      <ul>
        <li><a href="/login">Refresh this page</a></li>
        <li><a href="/api/auth/login">Start OAuth (API route)</a></li>
        <li><a href="/api/hello">API health check</a></li>
      </ul>

      <p style={{marginTop:24, color:'#666'}}>
        Note: visiting <code>/api/auth/callback</code> directly will show an error. That endpoint is only used when Microsoft
        redirects back after sign‑in.
      </p>
    </main>
  );
}
