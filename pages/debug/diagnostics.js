// pages/debug/diagnostics.js
// A single-page diagnostic panel with "hard reset + login".
// Buttons call existing API routes and show results inline.

import { useEffect, useState } from "react";

const APP_BASE = "https://alice-onenote-router.vercel.app";

// Helper fetcher
async function jget(path) {
  const res = await fetch(path, { credentials: "include" });
  let text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

export default function Diagnostics() {
  const [env, setEnv] = useState(null);
  const [session, setSession] = useState(null);
  const [tokens, setTokens] = useState(null);
  const [headers, setHeaders] = useState(null);
  const [cookies, setCookies] = useState(null);
  const [base, setBase] = useState(APP_BASE);

  async function reloadAll() {
    setBase(APP_BASE);
    const [e, s, t, h, c] = await Promise.all([
      jget("/api/debug/env"),
      jget("/api/debug/session"),
      jget("/api/debug/tokens"),
      jget("/api/debug/headers"),
      jget("/api/debug/show-cookies"),
    ]);
    setEnv(e);
    setSession(s);
    setTokens(t);
    setHeaders(h);
    setCookies(c);
  }

  useEffect(() => {
    reloadAll();
  }, []);

  function open(url) {
    window.location.href = url;
  }

  async function clearSessionCookies() {
    await jget("/api/debug/clear-cookies"); // returns {cleared:true,...}
    await reloadAll();
    alert("Cleared app session cookies.");
  }

  // This is the one-click "make MS prompt me and return tokens" path:
  // 1) Clear app cookies
  // 2) Hit MS logout so MS won’t silently reuse login
  // 3) Redirect back to our /api/auth/login (which sends us to authorize)
  async function hardResetAndLogin() {
    try {
      await jget("/api/debug/clear-cookies");
    } catch {}
    const msLogout =
      "https://login.microsoftonline.com/common/oauth2/v2.0/logout" +
      `?post_logout_redirect_uri=${encodeURIComponent(
        `${APP_BASE}/api/auth/login`
      )}`;
    open(msLogout);
  }

  // Just send user to our normal login handler
  function forceMicrosoftLogin() {
    open("/api/auth/login");
  }

  function logoutApp() {
    open("/api/auth/logout");
  }

  function refreshTokens() {
    open("/api/auth/refresh");
  }

  function box(title, obj) {
    return (
      <div style={{ margin: "18px 0" }}>
        <div style={{ fontWeight: 700 }}>{title}</div>
        <pre
          style={{
            background: "#111",
            color: "#eee",
            padding: 12,
            whiteSpace: "pre-wrap",
            borderRadius: 6,
          }}
        >
{JSON.stringify(obj ?? {}, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto", padding: 16 }}>
      <h2>Alice OneNote Router — Diagnostics</h2>
      <div style={{ marginBottom: 8, color: "#666" }}>
        Base URL (detected): <code>{base}</code>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <button onClick={hardResetAndLogin}>Hard Reset + Login</button>
        <button onClick={forceMicrosoftLogin}>Force Microsoft Login</button>
        <button onClick={clearSessionCookies}>Clear Session Cookies</button>
        <button onClick={logoutApp}>Logout (App)</button>
        <button onClick={refreshTokens}>Refresh Tokens</button>
        <button onClick={reloadAll}>Reload Panels</button>
      </div>

      {box("Environment (/api/debug/env)", env)}
      {box("Session (/api/debug/session)", session)}
      {box("Tokens (/api/debug/tokens)", tokens)}
      {box("Headers (/api/debug/headers)", headers)}
      {box("Cookies (/api/debug/show-cookies)", cookies)}

      <div style={{ marginTop: 24, fontSize: 13, color: "#888" }}>
        Tip: If **Tokens** still shows <code>null</code>, run **Hard Reset + Login** in a new
        incognito window to bypass any Microsoft account cookies.
      </div>
    </div>
  );
}
