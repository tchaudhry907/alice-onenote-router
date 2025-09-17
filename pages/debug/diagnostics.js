// pages/debug/diagnostics.js
import { useEffect, useMemo, useState } from "react";

export default function Diagnostics() {
  const [tokens, setTokens] = useState(null);
  const [status, setStatus] = useState("No tokens captured yet");
  const [seedResult, setSeedResult] = useState(null);
  const [meResult, setMeResult] = useState(null);
  const [createResult, setCreateResult] = useState(null);
  const [batchResult, setBatchResult] = useState(null);
  const [cleanupResult, setCleanupResult] = useState(null);

  const baseUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.protocol}//${window.location.host}`;
  }, []);

  const wantFull = useMemo(() => {
    if (typeof window === "undefined") return false;
    const p = new URLSearchParams(window.location.search);
    return ["1","true","yes"].includes((p.get("full") || "").toLowerCase());
  }, []);

  async function reloadTokens() {
    if (!baseUrl) return;
    try {
      const j = await fetch(`${baseUrl}/api/debug/tokens${wantFull ? "?full=1" : ""}`, {
        credentials: "include",
      }).then(r => r.json());
      setTokens(j);
      const hasAny = !!(j?.access_token || j?.refresh_token || j?.id_token);
      setStatus(hasAny ? "Tokens present" : "No tokens captured yet");
    } catch (e) {
      setStatus("Failed to load tokens");
    }
  }
  useEffect(() => { reloadTokens(); }, [baseUrl, wantFull]);

  async function copyAuthHeader() {
    try {
      if (!tokens?.access_token) { alert("No access_token in memory."); return; }
      const s = `Authorization: Bearer ${tokens.access_token}`;
      await navigator.clipboard.writeText(s);
      alert("Copied Authorization header to clipboard.");
    } catch (e) {
      alert("Could not copy to clipboard.");
    }
  }

  // Generic fetch with timeout that never leaves the UI in loading state
  async function fetchJSON(url, opts = {}, timeoutMs = 20000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...opts, signal: ctrl.signal });
      const ct = res.headers.get("content-type") || "";
      const body = ct.includes("application/json") ? await res.json() : await res.text();
      return { status: res.status, ok: res.ok, body };
    } catch (e) {
      return { status: 0, ok: false, body: { ok: false, error: String(e?.message || e) } };
    } finally {
      clearTimeout(t);
    }
  }

  async function seedServerWithTokens() {
    setSeedResult({ loading: true });
    try {
      if (!tokens?.access_token || !tokens?.refresh_token || !tokens?.id_token) {
        setSeedResult({ ok: false, error: "Need access_token + refresh_token + id_token. Click ‘Refresh Tokens’, then ‘Reload Tokens’, then try again." });
        return;
      }
      const r = await fetchJSON("/api/debug/tokens/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          id_token: tokens.id_token,
        }),
      });
      setSeedResult(r.body);
      await reloadTokens();
    } catch (e) {
      setSeedResult({ ok: false, error: String(e?.message || e) });
    }
  }

  async function callGraphMe() {
    setMeResult({ loading: true });
    const r = await fetchJSON("/api/onenote?act=me", { credentials: "include" });
    setMeResult(r.body);
  }

  async function createTestPage() {
    setCreateResult({ loading: true });
    const r = await fetchJSON("/api/debug/create-test-page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        notebookName: "AliceChatGPT",
        sectionName: "Hobbies",
        title: "[DIAG] Test page from Diagnostics",
        html: "<p>Created via Diagnostics button ✅</p>",
      }),
    });
    // Always set a result so the UI never stays "Loading…"
    setCreateResult(r.body);
  }

  async function batchCreateSections() {
    setBatchResult({ loading: true });
    const r = await fetchJSON("/api/onenote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        act: "sections-batch",
        notebookName: "AliceChatGPT",
        sectionNames: [
          "Inbox",
          "Food",
          "Fitness - Workouts",
          "Fitness - Step Counts",
          "Hobbies",
          "Travel",
          "Taxes",
          "Recycle Bin"
        ],
      }),
    });
    setBatchResult(r.body);
  }

  async function sweepTestNotes() {
    setCleanupResult({ loading: true });
    const r = await fetchJSON("/api/graph/cleanup-tests", {
      method: "POST",
      credentials: "include",
    });
    setCleanupResult(r.body);
  }

  return (
    <main style={{ padding: 24, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
      <h1>Alice OneNote Router — Diagnostics</h1>
      <p>Base: <code>{baseUrl}</code> · Status: <strong>{status}</strong></p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
        <button className="btn" onClick={async () => {
          // Do refresh via XHR so you STAY on this page
          const r = await fetchJSON("/api/auth/refresh", { method: "POST", credentials: "include" });
          // Show a toast-y result inline, then reload tokens
          alert(r.ok ? "Tokens refreshed." : `Refresh failed: ${JSON.stringify(r.body)}`);
          reloadTokens();
        }}>Refresh Tokens (stay)</button>

        <a className="btn" href="/api/auth/login">Force Microsoft Login</a>
        <a className="btn" href="/api/debug/clear-cookies">Clear Session Cookies</a>
        <a className="btn" href="/">Logout (App)</a>
        <a className="btn" href="/api/debug/tokens?full=1" target="_blank" rel="noreferrer">Open tokens (full)</a>
        <button className="btn" onClick={reloadTokens}>Reload Tokens</button>
      </div>

      <Section title={`Tokens (${wantFull ? "full, not truncated" : "masked"})`}>
        <pre style={{ whiteSpace: "pre-wrap" }}>
{tokens?.access_token ? `access_token length: ${tokens.access_token.length} · starts with:\n${String(tokens.access_token).slice(0,30)}…\n\n` : ""}
{fmt(tokens)}
        </pre>
      </Section>

      <h3 style={{ marginTop: 18 }}>Quick Actions</h3>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0" }}>
        <button className="btn" onClick={copyAuthHeader}>Copy Authorization header</button>
        <button className="btn" onClick={seedServerWithTokens}>Seed server with tokens</button>
        <button className="btn" onClick={callGraphMe}>Call Graph /me (server)</button>
        <button className="btn" onClick={createTestPage}>Create test page in Hobbies</button>
        <button className="btn" onClick={batchCreateSections}>Batch create sections</button>
        <button className="btn" onClick={sweepTestNotes}>Sweep test notes → Recycle Bin</button>
      </div>

      <Section title="Seed Result"><pre>{fmt(seedResult)}</pre></Section>
      <Section title="Graph /me Result"><pre>{fmt(meResult)}</pre></Section>
      <Section title="Create Test Page Result"><pre>{fmt(createResult)}</pre></Section>
      <Section title="Batch Create Sections Result"><pre>{fmt(batchResult)}</pre></Section>
      <Section title="Cleanup (Sweep Test Notes) Result"><pre>{fmt(cleanupResult)}</pre></Section>

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
        pre { margin: 0; }
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

function fmt(x) {
  if (x === null || x === undefined) return "—";
  if (x?.loading) return "Loading…";
  try { return JSON.stringify(x, null, 2); } catch { return String(x); }
}
