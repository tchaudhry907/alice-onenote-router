// pages/login-success.js
export default function LoginSuccess() {
  return (
    <main style={{fontFamily:"system-ui, -apple-system, Segoe UI, Roboto", padding:"24px", lineHeight:1.5}}>
      <h1>Alice OneNote Router</h1>
      <div style={{background:"#e6ffed", border:"1px solid #b7eb8f", padding:"12px", borderRadius:6, maxWidth:720}}>
        <p><strong>Signed in!</strong> Session cookie set.</p>
      </div>
      <p style={{marginTop:16}}>Next actions:</p>
      <ul>
        <li><a href="/api/debug/session">View session JSON</a></li>
        <li><a href="/api/graph/me">Call Graph: /me</a></li>
        <li><a href="/debug">Open debug tools</a></li>
        <li><a href="/">Back home</a></li>
      </ul>
    </main>
  );
}
