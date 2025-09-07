// pages/debug/diagnostics.js
// Fast, one-click diagnostics with auto login flow & token polling.

import { useEffect, useMemo, useRef, useState } from "react";

const APP_BASE = "https://alice-onenote-router.vercel.app";

const btn = {
  base: {
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #ccc",
    background: "#fff",
    cursor: "pointer",
    fontSize: 14,
  },
  primary: {
    background: "#111",
    color: "#fff",
    border: "1px solid #111",
  },
};

function CopyButton({ text, label = "Copy" }) {
  return (
    <button
      style={{ ...btn.base, marginLeft: 8 }}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text || "");
        } catch {}
      }}
      title="Copy to clipboard"
    >
      {label}
    </button>
  );
}

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ margin: "14px 0" }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          userSelect: "none",
          cursor: "pointer",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span
          style={{
            width: 18,
            height: 18,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid #bbb",
            borderRadius: 4,
            background: open ? "#111" : "#fff",
            color: open ? "#fff" : "#333",
            fontSize: 12,
          }}
        >
          {open ? "−" : "+"}
        </span>
        {title}
      </div>
      {open ? (
        <div style={{ marginTop: 8 }}>{children}</div>
      ) : (
        <div style={{ height: 6 }} />
      )}
    </div>
  );
}

function Pre({ data }) {
  const text =
    typeof data === "string" ? data : JSON.stringify(data ?? {}, null, 2);
  return (
    <pre
      style={{
        background: "#0f1115",
        color: "#eaeef5",
        padding: 12,
        whiteSpace: "pre-wrap",
        borderRadius: 8,
        margin: 0,
        overflowX: "auto",
      }}
    >
      {text}
    </pre>
  );
}

async function jget(path) {
  const res = await fetch(path, { credentials: "include" });
  const t = await res.text();
  try {
    return JSON.parse(t);
  } catch {
    return { _raw: t };
  }
}

export default function Diagnostics() {
  const [env, setEnv] = useState(null);
  const [session, setSession] = useState(null);
  const [tokens, setTokens] = useState(null);
  const [headers, setHeaders] = useState(null);
  const [cookies, setCookies] = useState(null);
  const [busy, setBusy] = useState(false);
  const [noteMsg, setNoteMsg] = useState("");
  const pollingRef = useRef(null);

  const qs = useMemo(
    () => Object.fromEntries(new URLSearchParams(location.search)),
    []
  );

  async function loadAll() {
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

  function open(url) {
    window.location.href = url;
  }

  async function clearCookies() {
    setBusy(true);
    try {
      await jget("/api/debug/clear-cookies");
    } catch {}
    await loadAll();
    setBusy(false);
  }

  // One-click: clear app cookies -> MS logout -> bounce back here -> auto-login
  async function hardResetAndLogin() {
    setBusy(true);
    try {
      await jget("/api/debug/clear-cookies");
    } catch {}
    const postBack = `${APP_BASE}/debug/diagnostics?after=login`;
    const msLogout =
      "https://login.microsoftonline.com/common/oauth2/v2.0/logout" +
      `?post_logout_redirect_uri=${encodeURIComponent(postBack)}`;
    open(msLogout);
  }

  function forceMicrosoftLogin() {
    open("/api/auth/login");
  }
  function refreshTokens() {
    open("/api/auth/refresh");
  }
  function logoutApp() {
    open("/api/auth/logout");
  }

  // Poll tokens after returning from login to avoid manual reload spam
  async function startTokenPolling(timeoutMs = 10000, everyMs = 1200) {
    const start = Date.now();
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      const t = await jget("/api/debug/tokens");
      setTokens(t);
      if (t?.refresh_token || Date.now() - start > timeoutMs) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
        loadAll();
      }
    }, everyMs);
  }

  // Quick OneNote write sanity test
  async function testWrite() {
    setNoteMsg("Writing…");
    try {
      const res = await fetch("/api/onenote/log", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Diagnostics quick test ✅" }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j?.ok) {
        setNoteMsg(
          `Success → pageId=${j.pageId} | title=${j.title || "(untitled)"}`
        );
      } else {
        setNoteMsg(
          `Failed (${res.status}) → ${JSON.stringify(j || {}, null, 2)}`
        );
      }
    } catch (err) {
      setNoteMsg(`Error → ${String(err)}`);
    }
  }

  // Initial load
  useEffect(() => {
    loadAll();
  }, []);

  // If we came back with ?after=login, auto-kick login once
  useEffect(() => {
    if (qs.after === "login") {
      // Replace the URL (nice UX), then trigger login
      const clean = new URL(location.href);
      clean.searchParams.delete("after");
      history.replaceState(null, "", clean.toString());
      // Immediately send to our login route
      forceMicrosoftLogin();
    }
  }, [qs.after]);

  // If we arrive to this page from /api/auth/callback, tokens may
  // land a split-second later — poll quickly to surface them.
  useEffect(() => {
    // Heuristic: if tokens currently null, poll for up to 10s
    if (!tokens?.refresh_token) startTokenPolling();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tokenSummary =
    tokens && (tokens.refresh_token || tokens.access_token || tokens.id_token)
      ? "✅ Tokens present"
      : "⛔ No tokens captured yet";

  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto",
        padding: 16,
        maxWidth: 980,
        margin: "0 auto",
      }}
    >
      <h2 style={{ margin: "6px 0 12px" }}>Alice OneNote Router — Diagnostics</h2>
      <div style={{ color: "#666", marginBottom: 12 }}>
        Base: <code>{APP_BASE}</code> • Status: <b>{tokenSummary}</b>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button style={{ ...btn.base, ...btn.primary }} onClick={hardResetAndLogin} disabled={busy}>
          Hard Reset + Login
        </button>
        <button style={btn.base} onClick={forceMicrosoftLogin} disabled={busy}>
          Force Microsoft Login
        </button>
        <button style={btn.base} onClick={refreshTokens} disabled={busy}>
          Refresh Tokens
        </button>
        <button style={btn.base} onClick={clearCookies} disabled={busy}>
          Clear Session Cookies
        </button>
        <button style={btn.base} onClick={logoutApp} disabled={busy}>
          Logout (App)
        </button>
        <button style={btn.base} onClick={loadAll} disabled={busy}>
          Reload Panels
        </button>
      </div>

      <Section title="Tokens (/api/debug/tokens)">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span>
            {tokens?.refresh_token ? "✅" : "⛔"} refresh_token •{" "}
            {tokens?.access_token ? "✅" : "⛔"} access_token •{" "}
            {tokens?.id_token ? "✅" : "⛔"} id_token
          </span>
          <CopyButton text={JSON.stringify(tokens ?? {}, null, 2)} />
        </div>
        <Pre data={tokens} />
      </Section>

      <Section title="Environment (/api/debug/env)" defaultOpen={false}>
        <Pre data={env} />
      </Section>

      <Section title="Session (/api/debug/session)" defaultOpen={false}>
        <Pre data={session} />
      </Section>

      <Section title="Headers (/api/debug/headers)" defaultOpen={false}>
        <Pre data={headers} />
      </Section>

      <Section title="Cookies (/api/debug/show-cookies)" defaultOpen={false}>
        <Pre data={cookies} />
      </Section>

      <Section title="Quick OneNote Write Test" defaultOpen={true}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <button style={{ ...btn.base, ...btn.primary }} onClick={testWrite}>
            Write “Diagnostics quick test ✅”
          </button>
          <span style={{ fontSize: 13, color: "#666" }}>
            (Requires valid tokens in session)
          </span>
        </div>
        {noteMsg ? <Pre data={noteMsg} /> : null}
      </Section>

      <div style={{ marginTop: 18, fontSize: 13, color: "#888" }}>
        Tip: If Tokens stay null, open this page in an **Incognito window** and press
        <b> Hard Reset + Login</b>. That guarantees a fresh Microsoft prompt.
      </div>
    </div>
  );
}
