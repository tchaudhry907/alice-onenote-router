// pages/debug/diagnostics.js
import { useEffect, useMemo, useRef, useState } from "react";

const btn = {
  base: {
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid #ccc",
    background: "#fff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    marginRight: 8,
    marginBottom: 8,
  },
  primary: {
    background: "#0b5fff",
    color: "#fff",
    border: "1px solid #0b5fff",
  },
  danger: {
    background: "#ff3b30",
    color: "#fff",
    border: "1px solid #ff3b30",
  },
  subtle: {
    background: "#f6f6f6",
  },
};

function Button({ children, style, onClick, title }) {
  return (
    <button
      title={title}
      style={{ ...btn.base, ...(style || {}) }}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ margin: "18px 0 8px", fontSize: 16 }}>{title}</h3>
      <div>{children}</div>
    </div>
  );
}

function TextRow({ label, value, placeholder, onChange, type = "text" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <label style={{ minWidth: 140, fontWeight: 600 }}>{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        style={{
          flex: 1,
          padding: "8px 10px",
          border: "1px solid #ccc",
          borderRadius: 8,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        }}
      />
    </div>
  );
}

export default function DiagnosticsPage() {
  const [baseUrl, setBaseUrl] = useState("");
  const [workerSecret, setWorkerSecret] = useState(""); // paste your cron secret here when needed
  const [result, setResult] = useState("");
  const [note, setNote] = useState("");
  const consoleRef = useRef(null);

  useEffect(() => {
    // Build absolute base from current location for consistent copy/paste links
    if (typeof window !== "undefined") {
      setBaseUrl(`${window.location.protocol}//${window.location.host}`);
    }
  }, []);

  const show = (title, data) => {
    const stamp = new Date().toLocaleString();
    let body = "";
    try {
      body = typeof data === "string" ? data : JSON.stringify(data, null, 2);
    } catch (e) {
      body = String(data);
    }
    setResult(`▶ ${title} @ ${stamp}\n\n${body}`);
    setTimeout(() => {
      consoleRef.current?.scrollTo?.({ top: consoleRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
  };

  const openAbs = (path) => {
    const url = `${baseUrl}${path}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const get = async (path, title) => {
    try {
      const res = await fetch(`${baseUrl}${path}`, { method: "GET", credentials: "include" });
      const ct = res.headers.get("content-type") || "";
      const data = ct.includes("application/json") ? await res.json() : await res.text();
      show(`${title} [GET ${path}]`, data);
    } catch (e) {
      show(`${title} [GET ${path}]`, String(e));
    }
  };

  const post = async (path, title, bodyObj, headers = {}) => {
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...headers },
        body: bodyObj ? JSON.stringify(bodyObj) : undefined,
      });
      const ct = res.headers.get("content-type") || "";
      const data = ct.includes("application/json") ? await res.json() : await res.text();
      show(`${title} [POST ${path}]`, data);
    } catch (e) {
      show(`${title} [POST ${path}]`, String(e));
    }
  };

  const groups = useMemo(
    () => [
      {
        title: "Auth",
        actions: [
          {
            label: "Sign In",
            style: btn.primary,
            onClick: () => openAbs("/api/auth/login"),
            tip: "Begin login flow (redirects to Microsoft).",
          },
          {
            label: "Callback (manual)",
            onClick: () => openAbs("/api/auth/callback"),
            tip: "Only if redirect didn’t happen automatically.",
          },
          {
            label: "Logout (force)",
            style: btn.danger,
            onClick: () => get("/api/debug/clear-cookies", "Clear Cookies"),
            tip: "Clears auth cookies on this domain.",
          },
        ],
      },
      {
        title: "Session & Cookies",
        actions: [
          { label: "Show Cookies (raw)", onClick: () => get("/api/debug/cookies", "Show Cookies") },
          { label: "Show Cookies (pretty)", onClick: () => get("/api/debug/show-cookies", "Show Cookies Pretty") },
          { label: "Token Peek", onClick: () => get("/api/debug/tokens", "Token Peek") },
          { label: "Token Ages", onClick: () => openAbs("/debug/token-ages") },
          { label: "Session Check", onClick: () => get("/api/debug/session", "Session Check") },
        ],
      },
      {
        title: "Graph / OneNote Probes",
        actions: [
          { label: "Graph Probe (/onenote/probe)", onClick: () => get("/api/onenote/probe", "Graph Probe") },
          { label: "Create Test Page", onClick: () => get("/api/debug/create-test-page", "Create Test Page") },
        ],
      },
      {
        title: "Cron / Worker",
        extra: (
          <>
            <TextRow
              label="Worker Secret"
              value={workerSecret}
              placeholder="paste your cron secret here (not stored)"
              onChange={(e) => setWorkerSecret(e.target.value)}
              type="password"
            />
          </>
        ),
        actions: [
          { label: "Bind Cron", onClick: () => get("/api/cron/bind", "Cron Bind") },
          {
            label: "Run Worker (POST, secret)",
            style: btn.primary,
            onClick: () =>
              post("/api/cron/worker", "Run Worker (POST)", { secret: workerSecret || "" }),
            tip: "Uses POST so your secret is not exposed in the URL.",
          },
          {
            label: "Run Worker (GET, secret in URL)",
            onClick: () => get(`/api/cron/worker?secret=${encodeURIComponent(workerSecret || "")}`, "Run Worker (GET)"),
            tip: "Convenient for testing; reveals the secret in URL—use sparingly.",
          },
        ],
      },
      {
        title: "Utilities",
        actions: [
          { label: "KV Ping", onClick: () => get("/api/redis/ping", "KV Ping") },
          { label: "Health", onClick: () => get("/api/health", "Health") },
          { label: "Routes", onClick: () => get("/api/debug/routes", "Route List") },
        ],
      },
    ],
    [baseUrl, workerSecret]
  );

  return (
    <div style={{ maxWidth: 980, margin: "24px auto", padding: "0 16px" }}>
      <h1 style={{ margin: "4px 0 10px" }}>Alice Diagnostics</h1>
      <p style={{ color: "#444", marginBottom: 16 }}>
        Quick controls for auth, cookies, Graph, and cron. Use the buttons below; results appear in the console.
      </p>

      <div
        style={{
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
          background: "#fafafa",
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600 }}>Base URL:</span>
          <code
            style={{
              background: "#fff",
              border: "1px solid #ddd",
              padding: "4px 8px",
              borderRadius: 6,
            }}
          >
            {baseUrl || "(resolving...)"}
          </code>
          <Button
            style={btn.subtle}
            onClick={() => {
              navigator.clipboard?.writeText(baseUrl || "");
              setNote("Copied base URL to clipboard.");
              setTimeout(() => setNote(""), 2000);
            }}
          >
            Copy
          </Button>
        </div>
        {note && <div style={{ marginTop: 8, color: "#0b5fff" }}>{note}</div>}
      </div>

      {groups.map((g, i) => (
        <Section key={i} title={g.title}>
          {g.extra || null}
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {g.actions.map((a, idx) => (
              <Button key={idx} style={a.style} onClick={a.onClick} title={a.tip}>
                {a.label}
              </Button>
            ))}
          </div>
        </Section>
      ))}

      <Section title="Result Console">
        <div
          ref={consoleRef}
          style={{
            border: "1px solid #e5e5e5",
            borderRadius: 12,
            padding: 12,
            minHeight: 220,
            background: "#0b1020",
            color: "#d7f7ff",
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
            whiteSpace: "pre-wrap",
            overflow: "auto",
          }}
        >
          {result || "Responses will appear here..."}
        </div>
      </Section>

      <p style={{ color: "#666", fontSize: 12, marginTop: 10 }}>
        Tip: Keep everything in the <strong>same tab</strong> after signing in so cookies stick.
      </p>
    </div>
  );
}
