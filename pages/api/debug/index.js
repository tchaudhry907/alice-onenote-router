// pages/debug/index.js
export default function DebugHome() {
  const base = "https://alice-onenote-router.vercel.app";
  return (
    <main style={{fontFamily:"system-ui, -apple-system, Segoe UI, Roboto", padding:"24px", lineHeight:1.5}}>
      <h1>Debug Tools</h1>
      <ul>
        <li><a href={`${base}/api/debug/cookies`}>View cookies (JSON)</a></li>
        <li><a href={`${base}/api/debug/pkce`}>View PKCE (verifier → challenge)</a></li>
        <li><a href={`${base}/api/debug/headers`}>View headers (JSON)</a></li>
        <li><a href={`${base}/api/debug/session`}>View session (JSON)</a></li>
        <li><a href={`${base}/api/debug/clear-cookies`}>Clear auth cookies</a></li>
        <li><a href={`${base}/api/auth/login`}>Start sign-in</a></li>
        <li><a href={`${base}/`}>Back to Home</a></li>
      </ul>
    </main>
  );
}
