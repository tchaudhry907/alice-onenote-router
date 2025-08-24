// pages/login.js
import React from "react";

export default function LoginPage() {
  return (
    <main style={{fontFamily:"system-ui, -apple-system, Segoe UI, Roboto, Arial", maxWidth: 720, margin:"2rem auto", lineHeight:1.6}}>
      <h1>Sign in</h1>
      <p>Click to begin the Microsoft sign‑in flow using PKCE.</p>
      <p><a href="/api/auth/login">Start sign‑in</a></p>
      <p><a href="/">Back home</a></p>
    </main>
  );
}
