export default function Home() {
  return (
    <div>
      <h1>Alice OneNote Router</h1>
      <p>This is the starting point for your OneNote integration.</p>

      <div style={{ background: "#e0f7e9", padding: "10px", borderRadius: "6px" }}>
        <h3>Quick actions</h3>
        <ul>
          <li><a href="/login">Sign in (friendly route)</a></li>
          <li><a href="/api/auth/login">Start OAuth (direct API route)</a></li>
          <li><a href="/api/me">Call Graph /me (JSON)</a></li>
          <li><a href="/api/onenote">Show OneNote notebooks (JSON)</a></li>
        </ul>
      </div>
    </div>
  );
}
