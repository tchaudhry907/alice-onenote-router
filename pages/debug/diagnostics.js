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
  const [sampleFoodResult, setSampleFoodResult] = useState(null);

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
      const j = await fetch(
        `${baseUrl}/api/debug/tokens${wantFull ? "?full=1" : ""}`,
        { credentials: "include" }
      ).then((r) => r.json());
      setTokens(j);
      const hasAny = !!(j?.access_token || j?.refresh_token || j?.id_token);
      setStatus(hasAny ? "Tokens present" : "No tokens captured yet");
    } catch {
      setStatus("Failed to load tokens");
    }
  }
  useEffect(() => {
    reloadTokens();
  }, [baseUrl, wantFull]);

  async function copyAuthHeader() {
    if (!tokens?.access_token) {
      alert("No access_token in memory.");
      return;
    }
    const s = `Authorization: Bearer ${tokens.access_token}`;
    await navigator.clipboard.writeText(s);
    alert("Copied Authorization header to clipboard.");
  }

  async function seedServerWithTokens() {
    if (
      !tokens?.access_token ||
      !tokens?.refresh_token ||
      !tokens?.id_token
    ) {
      alert(
        "Need access_token + refresh_token + id_token. Click ‘Refresh Tokens’, then ‘Reload Tokens’, then try again."
      );
      return;
    }
    const r = await fetch("/api/debug/tokens/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        id_token: tokens.id_token,
      }),
      credentials: "include",
    });
    const j = await r.json();
    setSeedResult(j);
    await reloadTokens();
  }

  async function callGraphMe() {
    const r = await fetch("/api/graph/me", { credentials: "include" });
    const j = await r.json();
    setMeResult(j);
  }

  async function createTestPage() {
    setCreateResult({ loading: true });
    const r = await fetch("/api/debug/create-test-page", {
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
    const j = await r.json();
    setCreateResult(j);
  }

  async function batchCreateSections() {
    setBatchResult({ loading: true });
    const r = await fetch("/api/graph/sections-create-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        notebookName: "AliceChatGPT",
        sectionNames: [
          "Inbox",
          "Food",
          "Fitness - Workouts",
          "Fitness - Step Counts",
          "Hobbies",
          "Travel",
          "Taxes",
          "Recycle Bin",
        ],
      }),
    });
    const j = await r.json();
    setBatchResult(j);
  }

  async function sweepTestNotes() {
    setCleanupResult({ loading: true });
    const r = await fetch("/api/graph/cleanup-tests", {
      method: "POST",
      credentials: "include",
    });
    const j = await r.json();
    setCleanupResult(j);
  }

  async function createSampleFoodNote() {
    setSampleFoodResult({ loading: true });
    const r = await fetch("/api/graph/create-read-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        notebookName: "AliceChatGPT",
        sectionName: "Food",
        title: "[FOOD] Sample entry — apple 95 kcal",
        html: "<p>Sample Food log created from Diagnostics 🍎</p>",
      }),
    });
    const j = await r.json();
    setSampleFoodResult(j);
  }

  return (
    <main
      style={{
        padding: 24,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      }}
    >
      <h1>Alice OneNote Router — Diagnostics</h1>
      <p>
        Base: <code>{baseUrl}</code> · Status: <strong>{status}</strong>
      </p>

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
          {tokens?.access_token
            ? `access_token length: ${tokens.access_token.length} · starts with:\n${tokens.access_token.slice(
                0,
                30
              )}…\n\n`
            : ""}
          {JSON.stringify(tokens, null, 2)}
        </pre>
        <TokenAge tokens={tokens} />
      </Section>

      <h3 style={{ marginTop: 18 }}>Quick Actions</h3>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0" }}>
        <button className="btn" onClick={copyAuthHeader}>Copy Authorization header</button>
        <button className="btn" onClick={seedServerWithTokens}>Seed server with tokens</button>
        <button className="btn" onClick={callGraphMe}>Call Graph /me (server)</button>
        <button className="btn" onClick={createTestPage}>Create test page in Hobbies</button>
        <button className="btn" onClick={batchCreateSections}>Batch create sections</button>
        <button className="btn" onClick={sweepTestNotes}>Sweep test notes → Recycle Bin</button>
        <button className="btn" onClick={createSampleFoodNote}>Create sample Food note</button>
      </div>

      <Section title="Seed Result"><pre>{fmt(seedResult)}</pre></Section>
      <Section title="Graph /me Result"><pre>{fmt(meResult)}</pre></Section>
      <Section title="Create Test Page Result"><pre>{fmt(createResult)}</pre></Section>
      <Section title="Batch Create Sections Result"><pre>{fmt(batchResult)}</pre></Section>
      <Section title="Cleanup (Sweep Test Notes) Result"><pre>{fmt(cleanupResult)}</pre></Section>
      <Section title="Sample Food Log Result"><pre>{fmt(sampleFoodResult)}</pre></Section>

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
        .btn:hover {
          background: #eee;
        }
        .badge {
          display: inline-block;
          margin-right: 8px;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 12px;
        }
      `}</style>
    </main>
  );
}

function Section({ title, children }) {
  return (
    <section style={{ marginTop: 18 }}>
      <h3 style={{ margin: "8px 0" }}>{title}</h3>
      <div
        style={{
          background: "#0d1117",
          color: "#c9d1d9",
          padding: 12,
          borderRadius: 6,
          overflowX: "auto",
        }}
      >
        {children}
      </div>
    </section>
  );
}

function fmt(x) {
  if (!x) return "—";
  if (x.loading) return "Loading…";
  try {
    return JSON.stringify(x, null, 2);
  } catch {
    return String(x);
  }
}

function TokenAge({ tokens }) {
  if (!tokens) return null;

  const render = (tok, label) => {
    if (!tok) return null;
    try {
      const [, payload] = tok.split(".");
      if (!payload) return null;
      const parsed = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
      const exp = parsed.exp ? parsed.exp * 1000 : null;
      if (!exp) return null;
      const secs = Math.floor((exp - Date.now()) / 1000);
      if (secs <= 0)
        return <span className="badge" style={{ background: "#ffdddd" }}>{label} expired</span>;
      if (secs < 1800)
        return <span className="badge" style={{ background: "#fff3cd" }}>{label} &lt; 30m</span>;
      return <span className="badge" style={{ background: "#d1e7dd" }}>{label} healthy</span>;
    } catch {
      return null;
    }
  };

  return (
    <div style={{ marginTop: 6 }}>
      {render(tokens.access_token, "Access token")}
      {render(tokens.refresh_token, "Refresh token")}
      {render(tokens.id_token, "ID token")}
    </div>
  );
}
