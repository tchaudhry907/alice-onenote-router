// pages/self-test.js
import { useEffect, useMemo, useState } from "react";

const DEFAULT_NOTEBOOK_ID = "0-824A10198D31C608!s3b9b14aca5434114998675fb1ad7cc6f"; // AliceChatGPT

const Endpoints = {
  hello: "/api/hello",
  signIn: "/api/auth/login",
  showCookies: "/api/debug/show-cookies",
  listNotebooks: "/api/graph/notebooks",
  listSections: (notebookId) =>
    `/api/graph/sections?notebookId=${encodeURIComponent(notebookId)}`,
  selfTest: (notebookId) =>
    `/api/self-test?notebookId=${encodeURIComponent(notebookId)}`,
  listInboxPages: `/api/graph/list-pages?sectionId=0-824A10198D31C608!scfd7de0686df4aa1bc663dd4e7769585&top=10`
};

function Link({ href, children }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
    >
      {children}
    </a>
  );
}

function Pretty({ data }) {
  return (
    <pre
      style={{
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        background: "#0b1020",
        color: "#e6f3ff",
        padding: "12px",
        borderRadius: 8,
        fontSize: 13,
        lineHeight: 1.35,
        overflowX: "auto",
      }}
    >
      {typeof data === "string" ? data : JSON.stringify(data, null, 2)}
    </pre>
  );
}

export default function SelfTest() {
  const [notebookId, setNotebookId] = useState(DEFAULT_NOTEBOOK_ID);
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState({});

  // Allow overriding notebook via ?notebookId=... in URL
  useEffect(() => {
    const u = new URL(window.location.href);
    const nid = u.searchParams.get("notebookId");
    if (nid) setNotebookId(nid);
  }, []);

  const call = async (label, href, opts = {}) => {
    setBusy(true);
    try {
      const res = await fetch(href, {
        method: opts.method || "GET",
        headers: { ...(opts.headers || {}) },
        body: opts.body || undefined,
        credentials: "include",
      });
      let data;
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        data = await res.json();
      } else {
        data = await res.text();
      }
      setOut((prev) => ({ ...prev, [label]: { ok: res.ok, status: res.status, data } }));
    } catch (e) {
      setOut((prev) => ({ ...prev, [label]: { ok: false, error: String(e) } }));
    } finally {
      setBusy(false);
    }
  };

  const Actions = useMemo(
    () => [
      {
        label: "Ping /api/hello",
        run: () => call("hello", Endpoints.hello),
      },
      {
        label: "Sign In (friendly flow)",
        run: () => (window.location.href = Endpoints.signIn),
      },
      {
        label: "Show Cookies",
        run: () => call("cookies", Endpoints.showCookies),
      },
      {
        label: "List Notebooks (friendly)",
        run: () => call("notebooks", Endpoints.listNotebooks),
      },
      {
        label: "List Sections (current notebook)",
        run: () => call("sections", Endpoints.listSections(notebookId)),
      },
      {
        label: "Run Full Self-Test",
        run: () => call("selfTest", Endpoints.selfTest(notebookId)),
      },
      {
        label: "List Recent Inbox Pages",
        run: () => call("inboxRecent", Endpoints.listInboxPages),
      },
    ],
    [notebookId]
  );

  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" }}>
      <div style={{ maxWidth: 980, margin: "24px auto", padding: "0 16px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.3 }}>
          Alice OneNote Router — Self Test UI
        </h1>

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "1fr",
            marginTop: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
              padding: 12,
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: "#fafafa",
            }}
          >
            <div style={{ fontWeight: 600 }}>NotebookId:</div>
            <input
              value={notebookId}
              onChange={(e) => setNotebookId(e.target.value)}
              style={{
                flex: "1 1 420px",
                minWidth: 300,
                border: "1px solid #d1d5db",
                borderRadius: 8,
                padding: "8px 10px",
                fontFamily: "monospace",
                fontSize: 13,
              }}
              placeholder="Notebook ID"
            />
            <Link href={`/api/graph/notebooks`}>Find My Notebook ID</Link>
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              (Default is your AliceChatGPT)
            </span>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              padding: 12,
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: "#fff",
            }}
          >
            {Actions.map((a) => (
              <button
                key={a.label}
                onClick={a.run}
                disabled={busy}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  background: busy ? "#f3f4f6" : "#0ea5e9",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                {a.label}
              </button>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "1fr",
              marginTop: 8,
            }}
          >
            {Object.entries(out).length === 0 ? (
              <div
                style={{
                  border: "1px dashed #d1d5db",
                  borderRadius: 12,
                  padding: 16,
                  color: "#6b7280",
                }}
              >
                Results will appear here…
              </div>
            ) : (
              Object.entries(out).map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: 12,
                    background: "#fff",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: 12,
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{k}</div>
                    <div
                      style={{
                        fontSize: 12,
                        color: v?.ok ? "#059669" : "#dc2626",
                        fontWeight: 700,
                      }}
                    >
                      {v?.ok ? "OK" : "ERROR"}
                      {typeof v?.status === "number" ? ` · ${v.status}` : ""}
                    </div>
                  </div>
                  <Pretty data={v?.data ?? v?.error ?? "(no data)"} />
                </div>
              ))
            )}
          </div>

          <div style={{ marginTop: 8, color: "#6b7280", fontSize: 12 }}>
            Tip: If any call returns <code>No access_token cookie</code>, click{" "}
            <b>Sign In (friendly flow)</b> first in this same tab, complete login,
            then try again.
          </div>
        </div>
      </div>
    </div>
  );
}
