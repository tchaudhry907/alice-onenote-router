// pages/debug/diagnostics.js
// Client-only diagnostics dashboard for auth + Graph quick-tests.

import { useEffect, useMemo, useState } from "react";

// Prevent Next from trying to pre-render dynamic data at build time
export const config = { unstable_runtimeJS: true };

export default function Diagnostics() {
  const [tokens, setTokens] = useState(null);
  const [status, setStatus] = useState("No tokens captured yet");

  const [seedResult, setSeedResult] = useState(null);
  const [meResult, setMeResult] = useState(null);
  const [createResult, setCreateResult] = useState(null);

  const baseUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.protocol}//${window.location.host}`;
  }, []);

  const wantFull = useMemo(() => {
    if (typeof window === "undefined") return false;
    const p = new URLSearchParams(window.location.search);
    return ["1", "true", "yes"].includes((p.get("full") || "").toLowerCase());
  }, []);

  async function reloadTokens() {
    if (!baseUrl) return;
    try {
      const j = await fetch(`${baseUrl}/api/debug/tokens${wantFull ? "?full=1" : ""}`, { credentials: "include" }).then(r => r.json());
      setTokens(j);
      const hasAny = !!(j?.access_token || j?.refresh_token || j?.id_token);
      setStatus(hasAny ? "Tokens present" : "No tokens captured yet");
    } catch {
      setStatus("Failed to load tokens");
    }
  }

  useEffect(() => { reloadTokens(); }, [baseUrl, wantFull]);

  // ---- helpers -------------------------------------------------------------

  async function copyAuthHeader() {
    if (!tokens?.access_token) {
      alert("No access_token in memory. Click Refresh Tokens first, then Reload Tokens.");
      return;
    }
    const s = `Authorization: Bearer ${tokens.access_token}`;
    await navigator.clipboard.writeText(s);
    alert("Copied Authorization header to clipboard.");
  }

  async function seedServerWithTokens() {
    if (!tokens?.access_token || !tokens?.refresh_token || !tokens?.id_token) {
      alert("Need access_token, refresh_token, and id_token to seed the server. Click ‘Refresh Tokens’, then ‘Reload Tokens’.");
      return;
    }
    const r = await fetch("/api/debug/tokens/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        id_token: tokens.id_token,
      }),
    });
    const j = await r.json();
    setSeedResult(j);
    await reloadTokens();
  }

  async function callGraphMe() {
    // Prefer cookie session; fallback to clipboard Authorization if present.
    const opts = { credentials: "include" };
    try {
      const r = await fetch("/api/graph/me", opts);
      if (r.status === 401) {
        const auth = await readAuthFromClipboard();
        if (auth) {
          const r2 = await fetch("/api/graph/me", { headers: { Authorization: auth }, credentials: "include" });
          const j2 = await r2.json();
          setMeResult(j2);
          return;
        }
      }
      const j = await r.json();
      setMeResult(j);
    } catch (e) {
      setMeResult({ error: String(e) });
    }
  }

  async function createTestPage() {
    // Prefer cookie session; fallback to clipboard Authorization if present.
    setCreateResult({ loading: true });
    const body = {
      notebookName: "AliceChatGPT",
      sectionName: "Hobbies",
      title: "[DIAG] Test page from Diagnostics",
      html: "<p>Created via Diagnostics button ✅</p>",
    };

    let r = await fetch("/api/debug/create-test-page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });

    if (r.status === 401) {
      const auth = await readAuthFromClipboard();
      if (auth) {
        r = await fetch("/api/debug/create-test-page", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: auth },
          credentials: "include",
          body: JSON.stringify(body),
        });
      }
    }

    try {
      const j = await r.json();
      setCreateResult(j);
    } catch (e) {
      setCreateResult({ ok: false, error: `Non-JSON response: ${e}` });
    }
  }

  async function readAuthFromClipboard() {
    if (typeof navigator?.clipboard?.readText !== "function") return null;
    try {
      const raw = (await navigator.clipboard.readText()).trim();
      if (!raw) return null;
      if (/^Authorization:\s*Bearer\s+/.test(raw)) return raw;
      if (/^Bearer\s+/.test(raw)) return `Authorization: ${raw}`;
      // Assume raw token
      return `Authorization: Bearer ${raw}`;
    } catch {
      return null;
    }
  }

  // ---- UI -----------------------------------------------------------------

  return (
    <main style={{ padding: 24, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
      <h1>Alice OneNote Router — Diagnostics</h1>
      <p>Base: <code>{baseUrl}</code> · Status: <strong>{status}</strong></p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
        <a className="btn" href="/api/auth/logout">Hard Reset + Logout</a>
        <a className="btn" href="/api/auth/login">Force Microsoft Login</a>
        <a className="btn" href="/api/auth/refresh">Refresh Tokens</a>
        <a className="btn" href="/api/debug/clear-cookies">Clear Session Cookies</a>
        <a className="btn" href="/">Logout (App)</a>
        <button className="btn" onClick={reloadTokens}>Reload Tokens</button>
        <a className="btn" href="/api/debug/tokens?full=1" target="_blank" rel="noreferrer">Open /api/debug/tokens?full=1</a>
      </div>

      <Section title={`Tokens (${wantFull ? "full, not truncated" : "masked"})`}>
        <pre style={{ whiteSpace: "pre-wrap" }}>
{tokens?.access_token ? `access_token length: ${tokens.access_token.length} · starts with:\n${(tokens.access_token || "").slice(0,30)}…\n\n` : ""}
{tokens ? JSON.stringify(tokens, null, 2) : "—"}
        </pre>
      </Section>

      <h3 style={{ marginTop: 18 }}>Quick Actions</h3>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0" }}>
        <button className="btn" onClick={copyAuthHeader}>Copy Authorization header</button>
        <button className="btn" onClick={seedServerWithTokens}>Seed server with tokens</button>
        <button className="btn" onClick={callGraphMe}>Call Graph /me (server)</button>
        <button className="btn" onClick={createTestPage}>Create test page in Hobbies</button>
      </div>

      <Section title="Seed Result">
        <pre>{seedResult ? JSON.stringify(seedResult, null, 2) : "—"}</pre>
      </Section>

      <Section title="Graph /me Result">
        <pre>{meResult ? JSON.stringify(meResult, null, 2) : "—"}</pre>
      </Section>

      <Section title="Create Test Page Result">
        <pre>{createResult ? JSON.stringify(createResult, null, 2) : "—"}</pre>
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
