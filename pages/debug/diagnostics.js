// pages/debug/diagnostics.js
import { useEffect, useMemo, useState } from "react";

export default function Diagnostics() {
  const [tokens, setTokens] = useState(null);
  const [loading, setLoading] = useState(false);
  const [seedResult, setSeedResult] = useState(null);
  const [meResult, setMeResult] = useState(null);

  const baseUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.protocol}//${window.location.host}`;
  }, []);

  // always pull FULL tokens here so “Copy Authorization” works
  async function loadTokens() {
    try {
      const r = await fetch(`/api/debug/tokens?full=1`);
      const j = await r.json();
      setTokens(j);
    } catch {
      setTokens(null);
    }
  }

  useEffect(() => { loadTokens(); }, []);

  const tokenStatus = (() => {
    if (!tokens) return { ok: false, text: "No tokens loaded yet" };
    const hasAny = !!(tokens.access_token || tokens.refresh_token || tokens.id_token);
    return { ok: hasAny, text: hasAny ? "Tokens present" : "No tokens captured yet" };
  })();

  const accessLen = tokens?.access_token ? tokens.access_token.length : 0;
  const accessHead = tokens?.access_token ? tokens.access_token.slice(0, 30) : "";

  async function seedServer() {
    if (!tokens?.access_token || !tokens?.refresh_token || !tokens?.id_token) {
      setSeedResult({ ok: false, error: "Missing one or more fields: access_token, refresh_token, id_token" });
      return;
    }
    setLoading(true);
    setSeedResult(null);
    try {
      const r = await fetch(`/api/debug/tokens/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          id_token: tokens.id_token,
        }),
      });
      const j = await r.json();
      setSeedResult({ ok: r.ok, data: j });
    } catch (e) {
      setSeedResult({ ok: false, error: String(e) });
    } finally {
      setLoading(false);
    }
  }

  async function callGraphMe() {
    setLoading(true);
    setMeResult(null);
    try {
      const r = await fetch(`/api/graph/me`);
      const j = await r.json();
      setMeResult({ ok: r.ok, status: r.status, data: j });
    } catch (e) {
      setMeResult({ ok: false, status: 0, error: String(e) });
    } finally {
      setLoading(false);
    }
  }

  function copyAuthorizationHeader() {
    if (!tokens?.access_token) return;
    const text = `Authorization: Bearer ${tokens.access_token}`;
    navigator.clipboard.writeText(text);
    alert("Copied Authorization header to clipboard.");
  }

  function openFullTokens() {
    window.open(`/api/debug/tokens?full=1`, "_blank", "noopener,noreferrer");
  }

  return (
    <main style={{ padding: 24, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
      <h1>Alice OneNote Router — Diagnostics</h1>

      <p style={{ marginTop: 6 }}>
        Base: <code>{baseUrl}</code> · Status:&nbsp;
        <Status ok={tokenStatus.ok} text={tokenStatus.text} />
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
        <a className="btn" href="/api/auth/logout">Hard Reset + Logout</a>
        <a className="btn" href="/api/auth/login">Force Microsoft Login</a>
        <a className="btn" href="/api/auth/refresh">Refresh Tokens</a>
        <a className="btn" href="/api/debug/clear-cookies">Clear Session Cookies</a>
        <a className="btn" href="/">Logout (App)</a>
        <button className="btn" onClick={loadTokens} disabled={loading}>Reload Tokens</button>
        <button className="btn" onClick={openFullTokens}>Open /api/debug/tokens?full=1</button>
      </div>

      <Section title="Tokens (full, not truncated)">
        <div style={{ marginBottom: 8 }}>
          access_token length: <strong>{accessLen}</strong>
          {accessLen > 0 && <> · starts with: <code>{accessHead}</code></>}
        </div>
        <pre style={{ margin: 0 }}>{JSON.stringify(tokens, null, 2)}</pre>
      </Section>

      <Section title="Quick Actions">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <button className="btn" onClick={copyAuthorizationHeader} disabled={!tokens?.access_token || loading}>
            Copy Authorization header
          </button>
          <button className="btn" onClick={seedServer} disabled={loading || !tokens?.access_token}>
            Seed server with tokens
          </button>
          <button className="btn" onClick={callGraphMe} disabled={loading}>
            Call Graph /me (server)
          </button>
        </div>

        {seedResult && (
          <ResultBlock title="Seed Result" ok={!!seedResult.ok} payload={seedResult.data || seedResult.error} />
        )}
        {meResult && (
          <ResultBlock title="Graph /me Result" ok={!!meResult.ok} payload={meResult.data || meResult.error} />
        )}
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
          cursor: pointer;
        }
        .btn[disabled] { opacity: 0.6; cursor: not-allowed; }
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

function Status({ ok, text }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          width: 10, height: 10, borderRadius: 10,
          background: ok ? "#2ea043" : "#f85149",
          display: "inline-block"
        }}
      />
      <strong>{text}</strong>
    </span>
  );
}

function ResultBlock({ title, ok, payload }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ marginBottom: 6 }}>
        <Status ok={ok} text={title} />
      </div>
      <pre style={{ margin: 0 }}>{typeof payload === "string" ? payload : JSON.stringify(payload, null, 2)}</pre>
    </div>
  );
}
