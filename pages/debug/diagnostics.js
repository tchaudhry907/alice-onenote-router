// pages/debug/diagnostics.js
// Simple, dependency-free diagnostics page with buttons and live results.

export default function Diagnostics() {
  const run = async (id, url) => {
    const el = document.getElementById(id);
    el.textContent = "…running…";
    try {
      const r = await fetch(url, { credentials: "include" });
      const text = await r.text();
      // Try to pretty print JSON if possible
      try {
        const j = JSON.parse(text);
        el.textContent = JSON.stringify(j, null, 2);
      } catch {
        el.textContent = text;
      }
    } catch (e) {
      el.textContent = String(e);
    }
  };

  const openAndReturn = (href) => {
    // Navigate but keep a return path back to diagnostics
    const u = new URL(href, location.origin);
    u.searchParams.set("return", "/debug/diagnostics");
    location.href = u.toString();
  };

  return (
    <html>
      <head>
        <title>Alice OneNote Router — Diagnostics</title>
        <meta charSet="utf-8" />
        <style>{`
          body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; padding: 24px; }
          h1 { margin: 0 0 6px; font-size: 20px; }
          .sub { color:#666; margin-bottom: 16px; }
          .row { display:flex; flex-wrap: wrap; gap:8px; margin-bottom: 14px; }
          button, a.btn {
            padding:8px 10px; border:1px solid #ccc; background:#fafafa; cursor:pointer; border-radius:6px;
            text-decoration:none; color:#111; display:inline-block;
          }
          button:hover, a.btn:hover { background:#f0f0f0; }
          pre {
            background:#0f172a; color:#e2e8f0; padding:12px; border-radius:8px; overflow:auto;
            font-size: 12px; line-height: 1.4; max-height: 360px;
          }
          .block { margin:16px 0; }
          .label { font-weight:600; margin:8px 0; }
        `}</style>
      </head>
      <body>
        <h1>Alice OneNote Router — Diagnostics</h1>
        <div className="sub">
          Base URL (detected): <code>{typeof window !== "undefined" ? window.location.origin : ""}</code>
        </div>

        <div className="row">
          <button onClick={() => openAndReturn("/api/auth/login?force=1")}>
            Force Microsoft Login
          </button>
          <button onClick={() => (location.href = "/api/debug/clear-cookies?return=/debug/diagnostics")}>
            Clear Session/Cookies
          </button>
          <button onClick={() => (location.href = "/api/auth/logout?return=/debug/diagnostics")}>
            Logout (App)
          </button>
          <a className="btn" href="/">Home</a>
        </div>

        <div className="row">
          <button onClick={() => run("env", "/api/debug/env")}>Env (Server)</button>
          <button onClick={() => run("session", "/api/debug/session")}>Session</button>
          <button onClick={() => run("tokens", "/api/debug/tokens")}>Tokens</button>
          <button onClick={() => run("headers", "/api/debug/headers")}>Headers</button>
          <button onClick={() => run("cookies", "/api/debug/show-cookies")}>Cookies</button>
        </div>

        <div className="row">
          {/* NEW: deep functional checks */}
          <button onClick={() => run("graph", "/api/debug/test-graph")}>
            Test Microsoft Graph (/me + OneNote)
          </button>
        </div>

        <div className="block">
          <div className="label">Environment (/api/debug/env)</div>
          <pre id="env">Click a button to load…</pre>
        </div>

        <div className="block">
          <div className="label">Session (/api/debug/session)</div>
          <pre id="session">Click a button to load…</pre>
        </div>

        <div className="block">
          <div className="label">Tokens (/api/debug/tokens)</div>
          <pre id="tokens">Click a button to load…</pre>
        </div>

        <div className="block">
          <div className="label">Headers (/api/debug/headers)</div>
          <pre id="headers">Click a button to load…</pre>
        </div>

        <div className="block">
          <div className="label">Cookies (/api/debug/show-cookies)</div>
          <pre id="cookies">Click a button to load…</pre>
        </div>

        <div className="block">
          <div className="label">Graph Test (/api/debug/test-graph)</div>
          <pre id="graph">Click “Test Microsoft Graph” above…</pre>
        </div>
      </body>
    </html>
  );
}
