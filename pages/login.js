// pages/login.js
export default function Login() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Sign in</h1>
      <p>Click to begin the Microsoft sign‑in flow using PKCE.</p>
      <p><a href="/api/auth/login">Start sign‑in</a></p>
      <p><a href="/">Back home</a></p>
    </main>
  );
}
