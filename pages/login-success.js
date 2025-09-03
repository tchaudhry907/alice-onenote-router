// pages/login-success.js
import { useEffect } from "react";

export default function LoginSuccess() {
  useEffect(() => {
    const id = setTimeout(() => window.location.replace("/api/ok"), 200);
    return () => clearTimeout(id);
  }, []);
  return (
    <main style={{ fontFamily: "system-ui", padding: 24 }}>
      <h1>Signed in</h1>
      <p>Redirecting to <code>/api/ok</code>…</p>
      <p>If nothing happens, click <a href="/api/ok">here</a>.</p>
    </main>
  );
}
