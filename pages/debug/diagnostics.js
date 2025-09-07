// pages/debug/diagnostics.js
import { useEffect, useMemo, useState } from "react";

export default function Diagnostics() {
  const [tokens, setTokens] = useState(null);
  const [status, setStatus] = useState("No tokens captured yet");

  const baseUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.protocol}//${window.location.host}`;
  }, []);

  const wantFull = useMemo(() => {
    if (typeof window === "undefined") return false;
    const p = new URLSearchParams(window.location.search);
    return ["1", "true", "yes"].includes((p.get("full") || "").toLowerCase());
  }, []);

  useEffect(() => {
    if (!baseUrl) return;
    fetch(`${baseUrl}/api/debug/tokens${wantFull ? "?full=1" : ""}`)
      .then((r) => r.json())
      .then((j) => {
        setTokens(j);
        const hasAny = !!(j.access_token || j.refresh_token || j.id_token);
        setStatus(hasAny ? "Tokens present" : "No tokens captured yet");
      })
      .catch(() => setStatus("Failed to load tokens"));
  }, [baseUrl, wantFull]);

  return (
    <main style={{ padding: 24, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
      <h1>Alice OneNote Router — Diagnostics</h1>
      <p>Base URL: <code>{baseUrl}</code> · Status: <strong>{status}</strong></p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
        <a className="btn" href="/api/auth/logout">Hard Reset + Logout</a>
        <a className="btn" href="/api/auth/login">Force Microsoft Login</a>
        <a className="btn" href="/api/auth/refresh">Refresh Tokens</a>
        <a className="btn" href="/api/debug/clear-cookies">Clear Session Cookies</a>
        <a className="btn" href="/">Logout (App)</a>
        <button className="btn" onClick={() => (typeof window !== "undefined" ? window.location.reload() : null)}>Reload Panels</button>
      </div>

      <Section title={`Tokens (${wantFull ? "full, not truncated" : "masked"})`}>
        <pre>{JSON.stringify(tokens, null, 2)}</pre>
      </Section>

      <style jsx>{`
        .btn {
          display: inline-block;
          padding: 6px 10px;
          border: 1px solid #ddd;
          border-radius: 6px;
          text-decoration: none;
          color: #111;
          background: #f7f7f9;
        }
        .btn:hover { background: #eee; }
      `}</style>
    </main>
  );
}

function Section({ title, children }) {
  return (
    <section style={{ marginTop: 18 }}>
      <h3 style={{ margin: "8px 0" }}>{title}</h3>
      <div style={{ background: "#0d1117", color: "#c9d1d9", padding: 12, borderRadius: 6, overflowX: "auto" }}>
        {children}
      </div>
    </section>
  );
}
