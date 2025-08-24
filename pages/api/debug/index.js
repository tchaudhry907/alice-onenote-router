import React from "react";

export default function Debug() {
  const link = (href, text) => (
    <li style={{ margin: "6px 0" }}>
      <a href={href}>{text}</a>
    </li>
  );

  return (
    <main style={{ maxWidth: 760, margin: "40px auto", fontFamily: "system-ui" }}>
      <h1>Debug tools</h1>
      <p>Use these helpers while we finish the flow.</p>

      <ul>
        {link("/api/debug/show-cookies", "Show cookies (JSON)")}
        {link("/api/debug/clear-cookies", "Clear session + state cookies")}
        {link("/api/auth/login", "Start sign-in (client_secret flow)")}
        {link("/", "Back home")}
      </ul>

      <p style={{ marginTop: 24, color: "#555" }}>
        Tip: run <code>/api/debug/clear-cookies</code> before each new sign‑in attempt so
        you don’t reuse an old <code>state</code> cookie.
      </p>
    </main>
  );
}
