// pages/index.js
export default function Home() {
  const base = 'https://alice-onenote-router.vercel.app'; // force production host
  return (
    <main style={{fontFamily:'system-ui', padding:'2rem', lineHeight:1.6}}>
      <h1>Alice OneNote Router</h1>
      <p>This is the starting point for your OneNote integration.</p>

      <h3>Quick actions</h3>
      <ul>
        <li>
          <a href={`${base}/login`}>Sign in to OneNote (friendly route)</a>
        </li>
        <li>
          <a href={`${base}/api/auth/login`}>Start OAuth (direct API route)</a>
        </li>
        <li>
          <a href={`${base}/api/hello`}>API health check</a>
        </li>
      </ul>

      <p style={{marginTop:'2rem', color:'#555'}}>
        Note: visiting <code>/api/auth/callback</code> directly will show an error. That endpoint is only used when
        Microsoft redirects back after sign‑in.
      </p>
    </main>
  );
}
