// pages/debug/diagnostics.js
import { useState } from "react";

function JsonBox({ title, data }) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginTop: 8 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{title}</div>
      <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {typeof data === "string" ? data : JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

export default function Diagnostics() {
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState([]);

  // inputs
  const [cronSecret, setCronSecret] = useState("");
  const [testText, setTestText] = useState("pumpkin spice latte — 300 calories");
  const [sectionId, setSectionId] = useState("");

  const pushResult = (title, data) =>
    setResults((r) => [{ title, data, t: Date.now() }, ...r].slice(0, 30));

  async function call(path, { method = "GET", body, headers } = {}) {
    setBusy(true);
    try {
      const url = path.startsWith("http") ? path : `${path}`;
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(headers || {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      let data;
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        data = await res.json();
      } else {
        data = await res.text();
      }
      return { status: res.status, ok: res.ok, data };
    } catch (e) {
      return { status: 0, ok: false, data: String(e) };
    } finally {
      setBusy(false);
    }
  }

  // Auth
  const doLogin = () => (window.location.href = "/api/auth/login");
  const doLogout = () => (window.location.href = "/api/auth/logout");
  const doCallback = () => (window.location.href = "/api/auth/callback");
  const peekTokens = async () => pushResult("Token Peek", await call("/api/debug/tokens"));
  const tokenAge = async () => pushResult("Token Age", await call("/api/debug/token-age"));
  const forceGraphToken = async () =>
    pushResult("Force Graph Token", await call("/api/auth/force-graph-token", { method: "POST" }));

  // Cookies
  const showCookies = async () => pushResult("Show Cookies", await call("/api/debug/show-cookies"));
  const clearCookies = async () =>
    pushResult("Clear Cookies", await call("/api/debug/clear-cookies", { method: "POST" }));

  // Redis & Health
  const redisPing = async () => pushResult("Redis Ping", await call("/api/redis/ping"));
  const health = async () => pushResult("App Health", await call("/api/health"));
  const cronHealth = async () => pushResult("Cron Health", await call("/api/cron/health"));

  // OneNote
  const probeMe = async () => pushResult("OneNote Probe (/me)", await call("/api/onenote/probe"));
  const quickLog = async () => {
    const body = sectionId ? { text: testText, sectionId } : { text: testText };
    pushResult("Quick Log", await call("/api/log", { method: "POST", body }));
  };
  const createTestPage = async () =>
    pushResult("Create Test Page", await call("/api/debug/create-test-page", { method: "POST" }));

  // Cron
  const bindCron = async () =>
    pushResult("Bind Cron", await call("/api/cron/bind", { method: "POST", body: { secret: cronSecret } }));
  const runWorker = async () =>
    pushResult("Run Worker", await call("/api/cron/worker", { method: "POST", body: { secret: cronSecret } }));

  // Misc
  const debugHeaders = async () => pushResult("Request Headers", await call("/api/debug/headers"));
  const debugEnv = async () => pushResult("Server Env (safe)", await call("/api/debug/env"));
  const sessions = async () => pushResult("Sessions", await call("/api/debug/sessions"));

  return (
    <div style={{ maxWidth: 980, margin: "24px auto", padding: "0 16px", fontFamily: "ui-sans-serif, system-ui, -apple-system" }}>
      <h1>Alice Diagnostics</h1>
      <p style={{ marginTop: 0 }}>Buttons to drive common flows (auth, tokens, cookies, Redis, OneNote, cron).</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
        {/* Inputs */}
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Inputs</h3>
          <label style={{ display: "block", marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>CRON Secret (Vercel → Settings → Env → CRON_SECRET)</div>
            <input
              type="text"
              value={cronSecret}
              onChange={(e) => setCronSecret(e.target.value)}
              placeholder="e.g. d8c4e3b8f1a64a09d5c9d2f6e8b4c3a1"
              style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccc" }}
            />
          </label>
          <label style={{ display: "block", marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>Test Text</div>
            <input
              type="text"
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccc" }}
            />
          </label>
          <label style={{ display: "block" }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>Optional Section ID (force)</div>
            <input
              type="text"
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              placeholder="leave blank to auto-route"
              style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccc" }}
            />
          </label>
        </div>

        {/* Auth */}
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Auth</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={doLogin} disabled={busy}>Sign In (MS)</button>
            <button onClick={doLogout} disabled={busy}>Force Logout</button>
            <button onClick={doCallback} disabled={busy}>Hit /api/auth/callback</button>
            <button onClick={peekTokens} disabled={busy}>Token Peek</button>
            <button onClick={tokenAge} disabled={busy}>Token Age</button>
            <button onClick={forceGraphToken} disabled={busy}>Force Graph Token</button>
          </div>
        </div>

        {/* Cookies */}
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Cookies</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={showCookies} disabled={busy}>Show Cookies</button>
            <button onClick={clearCookies} disabled={busy}>Clear Cookies</button>
          </div>
        </div>

        {/* Redis & Health */}
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Redis & Health</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={redisPing} disabled={busy}>Redis Ping</button>
            <button onClick={health} disabled={busy}>App Health</button>
            <button onClick={cronHealth} disabled={busy}>Cron Health</button>
          </div>
        </div>

        {/* OneNote */}
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>OneNote / Logging</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={probeMe} disabled={busy}>Probe (whoami)</button>
            <button onClick={quickLog} disabled={busy}>Quick Log (router)</button>
            <button onClick={createTestPage} disabled={busy}>Create Test Page</button>
          </div>
        </div>

        {/* Cron */}
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Cron / Worker</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={bindCron} disabled={busy}>Bind Cron (store token)</button>
            <button onClick={runWorker} disabled={busy}>Run Worker (manual)</button>
          </div>
        </div>

        {/* Misc */}
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Misc Debug</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={debugHeaders} disabled={busy}>Request Headers</button>
            <button onClick={debugEnv} disabled={busy}>Server Env (safe)</button>
            <button onClick={sessions} disabled={busy}>Sessions</button>
          </div>
        </div>

        {/* Results */}
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Results</h3>
          {results.length === 0 ? (
            <div style={{ color: "#777" }}>No calls yet. Click a button above.</div>
          ) : (
            results.map((r) => <JsonBox key={r.t} title={r.title} data={r.data} />)
          )}
        </div>
      </div>
    </div>
  );
}
