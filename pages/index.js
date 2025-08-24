// pages/index.js
import React from "react";
import Link from "next/link";

// Tiny helper to parse cookies on the server
function parseCookies(cookieHeader = "") {
  const out = {};
  cookieHeader.split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i > -1) {
      const k = p.slice(0, i).trim();
      const v = decodeURIComponent(p.slice(i + 1).trim());
      out[k] = v;
    }
  });
  return out;
}

export async function getServerSideProps({ req, query }) {
  const cookies = parseCookies(req.headers.cookie || "");
  const hasSession = cookies.session === "ok";
  const login = typeof query.login === "string" ? query.login : null;
  const reason = typeof query.reason === "string" ? query.reason : null;

  return {
    props: {
      hasSession,
      login,
      reason: reason || null,
    },
  };
}

export default function Home({ hasSession, login, reason }) {
  const banner =
    login === "success"
      ? { color: "#e6ffed", border: "#34d058", text: "Signed in! Session cookie set." }
      : login === "error"
      ? { color: "#ffeef0", border: "#d73a49", text: `Sign-in error: ${reason || "unknown"}` }
      : null;

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" }}>
      <h1>Alice OneNote Router</h1>
      <p>This is the starting point for your OneNote integration.</p>

      {banner && (
        <div style={{ background: banner.color, borderLeft: `6px solid ${banner.border}`, padding: "12px 14px", margin: "16px 0" }}>
          <strong>{banner.text}</strong>
        </div>
      )}

      {hasSession ? (
        <p style={{ marginTop: 8 }}>✅ Session detected. You can now proceed to building actual token storage/Graph calls.</p>
      ) : (
        <p style={{ marginTop: 8 }}>ℹ️ No session cookie yet. Click a sign-in link below.</p>
      )}

      <h3 style={{ marginTop: 24 }}>Quick actions</h3>
      <ul>
        <li>
          <Link href="/login">Sign in (friendly route)</Link>
        </li>
        <li>
          <a href="/api/auth/login">Start OAuth (direct API route)</a>
        </li>
        <li>
          <a href="/api/hello">API health check</a>
        </li>
        <li>
          <a href="/api/debug/session">Debug: show session status (JSON)</a>
        </li>
      </ul>

      <p style={{ marginTop: 24, color: "#6a737d" }}>
        Note: visiting <code>/api/auth/callback</code> directly will show an error. That endpoint is only used when Microsoft
        redirects back after sign-in.
      </p>
    </main>
  );
}
