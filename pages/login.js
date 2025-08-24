export default function Login() {
  return (
    <main style={{fontFamily:'system-ui', maxWidth:720, margin:'40px auto', lineHeight:1.5}}>
      <h2>Sign in</h2>
      <p>Click to begin the Microsoft sign‑in flow using PKCE.</p>
      <p><a href="/api/auth/login">Start sign‑in</a></p>
      <p><a href="/">Back home</a></p>
    </main>
  );
}
