// pages/login.js
export default function Login() {
  return (
    <main style={{fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial", padding: 24}}>
      <h1>Sign in</h1>
      <p>Click below to sign in with Microsoft and connect OneNote.</p>
      <p><a href="/api/auth/login">Continue with Microsoft</a></p>
    </main>
  );
}
