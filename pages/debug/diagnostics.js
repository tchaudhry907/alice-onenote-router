// pages/debug/diagnostics.js
// One-stop diagnostics: Login, Seed, Probe, Logout, Tokens (live)

import { useEffect, useState } from "react";

const btn = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #ccc",
  background: "#f7f7f7",
  cursor: "pointer",
};

const row = { display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 };

export default function Diagnostics() {
  const [status, setStatus] = useState("Idle");
  const [log, setLog] = useState([]);
  const [tokens, setTokens] = useState(null);

  function append(name, payload) {
    setLog((prev) => [{ ts: new Date().toLocaleTimeString(), name, payload }, ...prev].slice(0, 200));
  }

  async function fetchTokens() {
    try {
      const r = await fetch("/api/debug/tokens", { cache: "no-store" });
      const j = await r.json();
      setTokens(j);
      append("Tokens (refresh)", j);
    } catch (e) {
      append("Tokens (error)", e.message);
    }
  }

  useEffect(() => {
    fetchTokens();
    const url = new URL(window.location.href);
    if (url.searchParams.get("login") === "ok") {
      setStatus("Login OK — tokens saved");
      url.searchParams.delete("login");
      window.history.replaceState({}, "", url.toString());
    }
    if (url.searchParams.get("login") === "err") {
      setStatus("Login error — check details in Output");
      append("Login error", url.searchParams.get("msg") || "unknown");
      url.searchParams.delete("login");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  function forceMicrosoftLogin() {
    window.location.href = "/api/auth/login";
  }

  async function seedFromClipboardSmart() {
    setStatus("Reading clipboard…");
    try {
      const clip = await navigator.clipboard.readText();
      const mJwt = clip.match(/\b(eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+)\b/);
      if (mJwt) {
        const r = await fetch("/api/onenote/seed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: mJwt[1] }),
        });
        const j = await r.json();
        append("Seed JWT", j);
        setStatus(r.ok ? "Seeded JWT OK" : "Seed error");
        await fetchTokens();
        return;
      }
      const mRefresh = clip.match(/"refresh_token"\s*:\s*"([^"]+)"/) || clip.match(/\b(M\.C[^\s"]+)\b/);
      const refreshToken = mRefresh?.[1];
      if (refreshToken) {
        const r = await fetch("/api/onenote/seed-any", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        const j = await r.json();
        append("Seed via refresh_token", j);
        setStatus(r.ok ? "Refreshed + seeded OK" : "Refresh/seed error");
        await fetchTokens();
        return;
      }
      append("Seed from Clipboard", { error: "No JWT or refresh_token found in clipboard" });
      setStatus("Clipboard missing JWT/refresh_token");
    } catch (e) {
      append("Seed from Clipboard (error)", e.message);
      setStatus("Seed failed");
    }
  }

  async function probe() {
    setStatus("Probing Graph /me…");
    const r = await fetch("/api/onenote/probe", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    append("Probe /me", j);
    setStatus(r.ok && j.ok ? "Probe OK: 200" : "Probe failed");
  }

  async function logoutAll() {
    setStatus("Logging out…");
    const r = await fetch("/api/auth/logout", { method: "POST" });
    const j = await r.json().catch(() => ({}));
    append("Logout", j);
    try { localStorage.clear(); } catch {}
    try { sessionStorage.clear(); } catch {}
    document.cookie.split(";").forEach((c) => {
      const n = c.split("=")[0].trim();
      if (n) document.cookie = `${n}=; Path=/; Max-Age=0; SameSite=Lax`;
    });
    await fetchTokens();
    setStatus("Logged out — click Force Microsoft Login");
  }

  async function clearServerTokens() {
    setStatus("Clearing server tokens…");
    const r = await fetch("/api/onenote/token-clear", { method: "POST" });
    const j = await r.json().catch(() => ({}));
    append("Token Clear", j);
    await fetchTokens();
    setStatus("Server tokens cleared");
  }

  async function createTestPage() {
    setStatus("Creating test page…");
    const r = await fetch("/api/onenote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        act: "create",
        notebookName: "AliceChatGPT",
        sectionName: "Food and Nutrition – Meals",
        title: `[FOOD] Smoke test (${new Date().toLocaleString()})`,
        html: "ok",
      }),
    });
    const j = await r.json().catch(() => ({}));
    append("Create Page", j);
    setStatus(r.ok ? "Create OK" : "Create failed");
  }

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", padding: 24, lineHeight: 1.5 }}>
      <h1>Alice Diagnostics</h1>

      <h3>Auth</h3>
      <div style={row}>
        <button style={btn} onClick={forceMicrosoftLogin}>🔐 Force Microsoft Login</button>
        <button style={btn} onClick={logoutAll}>🚪 Logout (clear cookies + KV)</button>
        <button style={btn} onClick={clearServerTokens}>🧹 Clear Server Tokens</button>
      </div>

      <h3 style={{ marginTop: 24 }}>Tokens</h3>
      <div style={row}>
        <button style={btn} onClick={seedFromClipboardSmart}>🌱 Seed Server from Clipboard</button>
        <button style={btn} onClick={probe}>🧪 Probe Graph /me</button>
        <a href="/api/debug/tokens?full=1" style={{ ...btn, textDecoration: "none" }}>🔎 View Tokens JSON</a>
        <a href="/api/onenote/token-peek" style={{ ...btn, textDecoration: "none" }}>👀 Token Peek</a>
      </div>

      <div style={{ marginTop: 12, padding: 12, background: "#fafafa", border: "1px solid #eee", borderRadius: 8 }}>
        <b>Live tokens (from server KV):</b>
        <pre style={{ whiteSpace: "pre-wrap", overflowX: "auto" }}>
{tokens ? JSON.stringify(tokens, null, 2) : "Loading…"}
        </pre>
        <button style={btn} onClick={fetchTokens}>🔄 Refresh Tokens Panel</button>
      </div>

      <h3 style={{ marginTop: 24 }}>OneNote</h3>
      <div style={row}>
        <button style={btn} onClick={createTestPage}>📝 Create Test Page (Food & Nutrition – Meals)</button>
      </div>

      <h3 style={{ marginTop: 24 }}>Status</h3>
      <p><b>{status}</b></p>

      <h3>Output</h3>
      <div style={{ maxHeight: 420, overflow: "auto", border: "1px solid #eee", borderRadius: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#fafafa" }}>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #eee", width: 120 }}>Time</th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #eee", width: 220 }}>Action</th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #eee" }}>Payload</th>
            </tr>
          </thead>
          <tbody>
            {log.length ? log.map((row, i) => (
              <tr key={i}>
                <td style={{ padding: 8, borderBottom: "1px solid #f3f3f3" }}>{row.ts}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #f3f3f3" }}>{row.name}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #f3f3f3", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", whiteSpace: "pre-wrap" }}>
                  {typeof row.payload === "string" ? row.payload : JSON.stringify(row.payload, null, 2)}
                </td>
              </tr>
            )) : <tr><td colSpan={3} style={{ padding: 12, color: "#888" }}>No output yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
